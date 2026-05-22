import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { DriverCommand } from '../session/types';
import { PtyOutputEvent, PtyInputEvent } from '../events/types';

export interface PtyBrokerEvents {
  output: (event: PtyOutputEvent) => void;
  input: (event: PtyInputEvent) => void;
  exit: (code: number) => void;
}

export class PtyBroker extends EventEmitter {
  private process: pty.IPty | null = null;
  private sessionId: string;
  private scrollback: string[] = [];
  private maxScrollback = 10000;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  start(driver: DriverCommand): void {
    const shell = driver.command;
    const args = driver.args;

    this.process = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: driver.cwd,
      env: { ...process.env, ...driver.env } as Record<string, string>,
    });

    this.process.onData((data: string) => {
      this.scrollback.push(data);
      if (this.scrollback.length > this.maxScrollback) {
        this.scrollback.shift();
      }

      const event: PtyOutputEvent = {
        type: 'pty.output',
        id: uuid(),
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        data,
      };
      this.emit('output', event);
    });

    this.process.onExit(({ exitCode }) => {
      this.emit('exit', exitCode);
    });
  }

  write(data: string, source: 'human' | 'race_engineer' = 'human'): void {
    if (!this.process) return;

    this.process.write(data);

    const event: PtyInputEvent = {
      type: 'pty.input',
      id: uuid(),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      source,
      data,
    };
    this.emit('input', event);
  }

  resize(cols: number, rows: number): void {
    if (this.process) {
      this.process.resize(cols, rows);
    }
  }

  getScrollback(lines?: number): string {
    const data = lines
      ? this.scrollback.slice(-lines)
      : this.scrollback;
    return data.join('');
  }

  sendInterrupt(): void {
    if (this.process) {
      this.process.write('\x03'); // Ctrl+C
    }
  }

  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
