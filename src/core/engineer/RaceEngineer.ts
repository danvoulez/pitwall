import { MissionPacket, RadioMessage } from './types';
import { RACE_ENGINEER_SYSTEM_PROMPT } from './prompts/system';
import { redactSecrets } from '../security/SecretRedactor';

export interface LLMAdapter {
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

export class RaceEngineer {
  private llm: LLMAdapter;
  private history: RadioMessage[] = [];

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  async ask(userMessage: string, packet: MissionPacket): Promise<string> {
    this.history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    const packetText = this.formatPacket(packet);

    const messages = [
      { role: 'system', content: RACE_ENGINEER_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Current mission state:\n${redactSecrets(packetText)}`,
      },
      ...this.history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    const response = await this.llm.chat(messages);

    this.history.push({
      role: 'engineer',
      content: response,
      timestamp: new Date().toISOString(),
    });

    return response;
  }

  async generateDriverInstruction(humanRequest: string, packet: MissionPacket): Promise<string> {
    const messages = [
      { role: 'system', content: RACE_ENGINEER_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Current mission state:\n${redactSecrets(this.formatPacket(packet))}`,
      },
      {
        role: 'user',
        content: `The operator wants to send this instruction to the driver. Translate it into a clear, safe terminal message:\n\n"${humanRequest}"`,
      },
    ];

    return this.llm.chat(messages);
  }

  getHistory(): RadioMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  private formatPacket(packet: MissionPacket): string {
    return `
MISSION: ${packet.mission.title}
INTENT: ${packet.mission.userIntent}
STATUS: ${packet.mission.currentStatus}

RECENT TERMINAL OUTPUT (last ~2000 chars):
${packet.terminal.recentOutput.slice(-2000)}

RECENT INPUTS: ${packet.terminal.recentInputs.slice(-5).join(' | ')}

CHANGED FILES: ${packet.repo.changedFiles.join(', ') || 'none'}
DIFF STAT:
${packet.repo.diffStat}

DIFF PREVIEW:
${packet.repo.diffPreview.slice(0, 3000)}

TEST RESULTS: ${packet.tests.recentResults.join(' | ') || 'none'}

CLAIMS:
${packet.claims.map(c => `- "${c.text}" [${c.evidenceStatus}]`).join('\n') || 'none'}

RISKS:
${packet.risks.map(r => `- [${r.level}] ${r.description}`).join('\n') || 'none'}

OPEN QUESTIONS: ${packet.openQuestions.join(', ') || 'none'}
`.trim();
  }
}
