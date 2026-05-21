import { v4 as uuid } from 'uuid';
import path from 'path';
import os from 'os';
import { SessionConfig, SessionState } from './types';
import { PitwallEvent } from '../events/types';
import { EventLedger } from '../events/EventLedger';
import { PtyBroker } from '../pty/PtyBroker';
import { RepoWatcher } from '../repo/RepoWatcher';
import { GitMonitor } from '../repo/GitMonitor';
import { CommandDetector } from '../detector/CommandDetector';
import { TestDetector } from '../detector/TestDetector';
import { ClaimManager } from '../claims/ClaimManager';
import { GateManager } from '../gates/GateManager';
import { RaceEngineer, LLMAdapter } from '../engineer/RaceEngineer';
import { ShadowLanes } from '../lanes/ShadowLanes';
import { MissionPacket } from '../engineer/types';
import { Claim } from '../claims/types';
import { Gate } from '../gates/types';
import { LaneObservation } from '../lanes/types';

export class SessionManager {
  readonly id: string;
  readonly config: SessionConfig;

  private state: SessionState;
  private ledger: EventLedger;
  private ptyBroker: PtyBroker;
  private repoWatcher: RepoWatcher;
  private gitMonitor: GitMonitor;
  private commandDetector: CommandDetector;
  private testDetector: TestDetector;
  private claimManager: ClaimManager;
  private gateManager: GateManager;
  private raceEngineer: RaceEngineer;
  private shadowLanes: ShadowLanes;

  private changedFiles: Set<string> = new Set();
  private recentCommands: string[] = [];
  private recentTestResults: string[] = [];
  private eventListeners: Array<(event: PitwallEvent) => void> = [];

  constructor(config: SessionConfig, llm: LLMAdapter) {
    this.id = uuid();
    this.config = config;

    const sessionDir = path.join(os.homedir(), '.pitwall', 'sessions', this.id);

    this.state = {
      id: this.id,
      config,
      status: 'starting',
      startedAt: new Date().toISOString(),
    };

    this.ledger = new EventLedger(sessionDir);
    this.ptyBroker = new PtyBroker(this.id);
    this.repoWatcher = new RepoWatcher(this.id, config.repoPath);
    this.gitMonitor = new GitMonitor(this.id, config.repoPath);
    this.commandDetector = new CommandDetector(this.id);
    this.testDetector = new TestDetector(this.id);
    this.claimManager = new ClaimManager();
    this.gateManager = new GateManager();
    this.raceEngineer = new RaceEngineer(llm);
    this.shadowLanes = new ShadowLanes(llm);

    this.wireEvents();
  }

  private wireEvents(): void {
    // PTY output → detectors + ledger
    this.ptyBroker.on('output', (event: PitwallEvent) => {
      this.recordEvent(event);
      if (event.type === 'pty.output') {
        this.commandDetector.feed(event.data);
        this.testDetector.feed(event.data);
        // Detect claims from driver output
        this.claimManager.detectClaims(event.data, 'driver', this.id);
      }
    });

    this.ptyBroker.on('input', (event: PitwallEvent) => {
      this.recordEvent(event);
    });

    this.ptyBroker.on('exit', (_code: number) => {
      this.state.status = 'completed';
      this.state.endedAt = new Date().toISOString();
      this.recordEvent({
        type: 'mission.state',
        id: uuid(),
        sessionId: this.id,
        timestamp: new Date().toISOString(),
        status: 'completed',
      });
    });

    // File watcher → ledger
    this.repoWatcher.on('fileChanged', (event: PitwallEvent) => {
      this.recordEvent(event);
      if (event.type === 'file.changed') {
        if (event.change === 'deleted') {
          this.changedFiles.delete(event.path);
        } else {
          this.changedFiles.add(event.path);
        }
      }
    });

    // Command detector handler
    this.commandDetector.setHandler((event) => {
      this.recordEvent(event);
      this.recentCommands.push(event.command);
      if (this.recentCommands.length > 20) this.recentCommands.shift();
    });

    // Test detector handler
    this.testDetector.setHandler((event) => {
      this.recordEvent(event);
      this.recentTestResults.push(`${event.framework}: ${event.status}`);
      if (this.recentTestResults.length > 20) this.recentTestResults.shift();
    });
  }

  private recordEvent(event: PitwallEvent): void {
    this.ledger.append(event);
    this.gateManager.processEvent(event);
    this.claimManager.processEvent(event);
    for (const listener of this.eventListeners) {
      try { listener(event); } catch { /* ignore */ }
    }
  }

  start(): void {
    this.state.status = 'running';
    this.recordEvent({
      type: 'mission.state',
      id: uuid(),
      sessionId: this.id,
      timestamp: new Date().toISOString(),
      status: 'running',
    });

    this.ptyBroker.start(this.config.driver);
    this.repoWatcher.start();
    this.gitMonitor.startPolling(3000, (snapshot) => {
      this.recordEvent(snapshot);
    });
  }

  // Terminal interaction
  writeToTerminal(data: string, source: 'human' | 'race_engineer' = 'human'): void {
    this.ptyBroker.write(data, source);
  }

  resizeTerminal(cols: number, rows: number): void {
    this.ptyBroker.resize(cols, rows);
  }

  interrupt(): void {
    this.ptyBroker.sendInterrupt();
  }

  // Race Radio
  async askEngineer(message: string): Promise<string> {
    const packet = await this.buildMissionPacket();
    return this.raceEngineer.ask(message, packet);
  }

  async sendToDriver(instruction: string): Promise<string> {
    const packet = await this.buildMissionPacket();
    const formatted = await this.raceEngineer.generateDriverInstruction(instruction, packet);

    // Send to terminal
    this.ptyBroker.write(formatted + '\n', 'race_engineer');

    this.recordEvent({
      type: 'engineer.message',
      id: uuid(),
      sessionId: this.id,
      timestamp: new Date().toISOString(),
      role: 'engineer',
      content: formatted,
    });

    return formatted;
  }

  // Shadow Lanes
  async updateLanes(): Promise<LaneObservation[]> {
    const packet = await this.buildMissionPacket();
    return this.shadowLanes.observeAll(packet);
  }

  // State
  async getFullState(): Promise<{
    session: SessionState;
    changedFiles: string[];
    diffStat: string;
    claims: Claim[];
    gates: Gate[];
    laneObservations: LaneObservation[];
    recentEvents: PitwallEvent[];
  }> {
    const diffStat = await this.gitMonitor.getDiffStat();
    return {
      session: this.state,
      changedFiles: Array.from(this.changedFiles),
      diffStat,
      claims: this.claimManager.getClaims(),
      gates: this.gateManager.getGates(),
      laneObservations: this.shadowLanes.getObservations(),
      recentEvents: this.ledger.getRecent(this.id, 50),
    };
  }

  async buildMissionPacket(): Promise<MissionPacket> {
    const diffStat = await this.gitMonitor.getDiffStat();
    const diffPreview = await this.gitMonitor.getDiffPreview();

    return {
      mission: {
        id: this.config.mission.id,
        title: this.config.mission.title,
        userIntent: this.config.mission.intent,
        currentStatus: this.state.status,
      },
      terminal: {
        recentOutput: this.ptyBroker.getScrollback(200),
        recentInputs: this.recentCommands.slice(-10),
      },
      repo: {
        cwd: this.config.repoPath,
        changedFiles: Array.from(this.changedFiles),
        diffStat,
        diffPreview,
      },
      tests: {
        recentCommands: this.recentCommands.filter(c =>
          /test|spec|check|lint/i.test(c)
        ),
        recentResults: this.recentTestResults,
      },
      claims: this.claimManager.getClaims(),
      risks: [],
      openQuestions: [],
    };
  }

  // Timeline
  getTimeline(): PitwallEvent[] {
    return this.ledger.query(this.id);
  }

  // Event subscription
  onEvent(listener: (event: PitwallEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  // Snapshot
  async snapshot(): Promise<object> {
    const state = await this.getFullState();
    return {
      ...state,
      scrollback: this.ptyBroker.getScrollback(500),
      timestamp: new Date().toISOString(),
    };
  }

  stop(): void {
    this.ptyBroker.kill();
    this.repoWatcher.stop();
    this.gitMonitor.stopPolling();
    this.ledger.close();
    this.state.status = 'completed';
    this.state.endedAt = new Date().toISOString();
  }
}
