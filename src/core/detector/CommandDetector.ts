import { v4 as uuid } from 'uuid';
import { CommandDetectedEvent } from '../events/types';

const COMMAND_PATTERNS: Array<{ pattern: RegExp; confidence: 'low' | 'medium' | 'high' }> = [
  { pattern: /^\$ (.+)$/m, confidence: 'high' },
  { pattern: /^> (.+)$/m, confidence: 'medium' },
  { pattern: /^❯ (.+)$/m, confidence: 'high' },
  { pattern: /^➜ .+ (.+)$/m, confidence: 'medium' },
];

const KNOWN_COMMANDS = [
  'npm', 'npx', 'pnpm', 'yarn', 'bun',
  'git', 'python', 'pip', 'cargo', 'rustc',
  'go', 'make', 'cmake', 'docker', 'kubectl',
  'node', 'deno', 'tsx', 'ts-node',
  'jest', 'vitest', 'pytest', 'mocha',
  'eslint', 'prettier', 'tsc',
  'cat', 'ls', 'cd', 'mkdir', 'rm', 'cp', 'mv',
  'curl', 'wget', 'ssh',
];

export class CommandDetector {
  private sessionId: string;
  private buffer: string = '';
  private onCommand: ((event: CommandDetectedEvent) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setHandler(handler: (event: CommandDetectedEvent) => void): void {
    this.onCommand = handler;
  }

  feed(data: string): CommandDetectedEvent[] {
    this.buffer += data;
    const events: CommandDetectedEvent[] = [];

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
      if (!stripped) continue;

      for (const { pattern, confidence } of COMMAND_PATTERNS) {
        const match = stripped.match(pattern);
        if (match) {
          const cmd = match[1].trim();
          const firstWord = cmd.split(/\s+/)[0];
          if (KNOWN_COMMANDS.some(k => firstWord === k || firstWord.endsWith('/' + k))) {
            const event: CommandDetectedEvent = {
              type: 'command.detected',
              id: uuid(),
              sessionId: this.sessionId,
              timestamp: new Date().toISOString(),
              command: cmd,
              confidence,
            };
            events.push(event);
            this.onCommand?.(event);
          }
          break;
        }
      }
    }

    return events;
  }
}
