import { LaneObservation, ShadowLane } from './types';
import { MissionPacket } from '../engineer/types';
import { LLMAdapter } from '../engineer/RaceEngineer';
import { SCOUT_PROMPT, REVIEWER_PROMPT, TEST_MONITOR_PROMPT, RISK_MONITOR_PROMPT } from '../engineer/prompts/system';
import { redactSecrets } from '../security/SecretRedactor';

const LANE_PROMPTS: Record<ShadowLane, string> = {
  scout: SCOUT_PROMPT,
  reviewer: REVIEWER_PROMPT,
  test_monitor: TEST_MONITOR_PROMPT,
  risk_monitor: RISK_MONITOR_PROMPT,
};

export class ShadowLanes {
  private llm: LLMAdapter;
  private observations: Map<ShadowLane, LaneObservation> = new Map();

  constructor(llm: LLMAdapter) {
    this.llm = llm;
    const lanes: ShadowLane[] = ['scout', 'reviewer', 'test_monitor', 'risk_monitor'];
    for (const lane of lanes) {
      this.observations.set(lane, {
        lane,
        status: 'idle',
        summary: '',
        confidence: 'low',
        relatedEvents: [],
      });
    }
  }

  async observe(lane: ShadowLane, packet: MissionPacket): Promise<LaneObservation> {
    const prompt = LANE_PROMPTS[lane];
    const packetSummary = this.buildLaneContext(lane, packet);

    try {
      const response = await this.llm.chat([
        { role: 'system', content: prompt },
        { role: 'user', content: redactSecrets(packetSummary) },
      ]);

      const hasWarning = /warn|danger|risk|concern|issue|problem|missing/i.test(response);

      const observation: LaneObservation = {
        lane,
        status: hasWarning ? 'warning' : 'observing',
        summary: response,
        confidence: 'medium',
        relatedEvents: [],
      };

      this.observations.set(lane, observation);
      return observation;
    } catch {
      return this.observations.get(lane)!;
    }
  }

  async observeAll(packet: MissionPacket): Promise<LaneObservation[]> {
    const lanes: ShadowLane[] = ['scout', 'reviewer', 'test_monitor', 'risk_monitor'];
    const results = await Promise.all(lanes.map(l => this.observe(l, packet)));
    return results;
  }

  getObservations(): LaneObservation[] {
    return Array.from(this.observations.values());
  }

  private buildLaneContext(lane: ShadowLane, packet: MissionPacket): string {
    switch (lane) {
      case 'scout':
        return `Mission: ${packet.mission.title}\nIntent: ${packet.mission.userIntent}\nChanged files: ${packet.repo.changedFiles.join(', ')}\nRecent output:\n${packet.terminal.recentOutput.slice(-1000)}`;
      case 'reviewer':
        return `Mission: ${packet.mission.title}\nDiff:\n${packet.repo.diffPreview.slice(0, 3000)}\nDiff stat:\n${packet.repo.diffStat}`;
      case 'test_monitor':
        return `Mission: ${packet.mission.title}\nTest commands: ${packet.tests.recentCommands.join(', ')}\nTest results: ${packet.tests.recentResults.join(' | ')}\nClaims: ${packet.claims.map(c => `"${c.text}" [${c.evidenceStatus}]`).join(', ')}`;
      case 'risk_monitor':
        return `Mission: ${packet.mission.title}\nStatus: ${packet.mission.currentStatus}\nChanged files: ${packet.repo.changedFiles.join(', ')}\nRecent output:\n${packet.terminal.recentOutput.slice(-1000)}\nClaims: ${packet.claims.map(c => `"${c.text}" [${c.evidenceStatus}]`).join(', ')}\nRisks: ${packet.risks.map(r => `[${r.level}] ${r.description}`).join(', ')}`;
    }
  }
}
