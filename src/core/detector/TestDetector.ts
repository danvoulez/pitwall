import { v4 as uuid } from 'uuid';
import { TestDetectedEvent } from '../events/types';

type TestFramework = 'jest' | 'vitest' | 'pytest' | 'go test' | 'cargo test' | 'unknown';

interface TestPattern {
  framework: TestFramework;
  passPatterns: RegExp[];
  failPatterns: RegExp[];
}

const TEST_PATTERNS: TestPattern[] = [
  {
    framework: 'jest',
    passPatterns: [
      /Tests:\s+\d+ passed/,
      /Test Suites:\s+\d+ passed/,
      /PASS\s+\S+\.(?:test|spec)\.\w+/,
    ],
    failPatterns: [
      /Tests:\s+\d+ failed/,
      /Test Suites:\s+\d+ failed/,
      /FAIL\s+\S+\.(?:test|spec)\.\w+/,
    ],
  },
  {
    framework: 'vitest',
    passPatterns: [
      /Tests\s+\d+ passed/,
      /\d+ tests? passed/,
    ],
    failPatterns: [
      /Tests\s+\d+ failed/,
      /\d+ tests? failed/,
    ],
  },
  {
    framework: 'pytest',
    passPatterns: [
      /=+ \d+ passed/,
      /\d+ passed in [\d.]+s/,
    ],
    failPatterns: [
      /=+ \d+ failed/,
      /FAILED\s+\S+::\S+/,
      /[1-9]\d* failed,?\s+/,
    ],
  },
  {
    framework: 'go test',
    passPatterns: [/^ok\s+\S+\s+[\d.]+s/m],
    failPatterns: [/^FAIL\s+\S+/m, /--- FAIL:\s+\S+/],
  },
  {
    framework: 'cargo test',
    passPatterns: [/test result: ok\.\s+\d+ passed/],
    failPatterns: [/test result: FAILED/],
  },
];

const TEST_COMMAND_PATTERN = /(?:npm|pnpm|yarn|npx)\s+(?:test|vitest|jest)|pytest|go\s+test|cargo\s+test|vitest|jest/;

export class TestDetector {
  private sessionId: string;
  private buffer: string = '';
  private onTest: ((event: TestDetectedEvent) => void) | null = null;
  private testCommandActive = false;
  private lastTestCommandTime = 0;
  private testCommandWindowMs = 60000;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setHandler(handler: (event: TestDetectedEvent) => void): void {
    this.onTest = handler;
  }

  markTestCommandActive(): void {
    this.testCommandActive = true;
    this.lastTestCommandTime = Date.now();
  }

  isTestActive(): boolean {
    if (!this.testCommandActive) return false;
    if (Date.now() - this.lastTestCommandTime > this.testCommandWindowMs) {
      this.testCommandActive = false;
      return false;
    }
    return true;
  }

  feed(data: string): TestDetectedEvent[] {
    this.buffer += data;
    const events: TestDetectedEvent[] = [];

    if (this.buffer.length > 8000) {
      this.buffer = this.buffer.slice(-4000);
    }

    const stripped = this.buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    // Check if this chunk contains a test command invocation
    if (TEST_COMMAND_PATTERN.test(stripped)) {
      this.markTestCommandActive();
    }

    // Framework-specific patterns — check pass before fail to avoid false negatives
    // when summary lines contain both "passed" and "failed" counts
    for (const tp of TEST_PATTERNS) {
      for (const pattern of tp.passPatterns) {
        const match = stripped.match(pattern);
        if (match) {
          const event = this.createEvent(tp.framework, 'passed', match[0]);
          events.push(event);
          this.onTest?.(event);
          this.buffer = '';
          return events;
        }
      }
      for (const pattern of tp.failPatterns) {
        const match = stripped.match(pattern);
        if (match) {
          const event = this.createEvent(tp.framework, 'failed', match[0]);
          events.push(event);
          this.onTest?.(event);
          this.buffer = '';
          return events;
        }
      }
    }

    return events;
  }

  private createEvent(
    framework: TestFramework,
    status: 'passed' | 'failed' | 'running' | 'unknown',
    excerpt: string
  ): TestDetectedEvent {
    return {
      type: 'test.detected',
      id: uuid(),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      framework,
      status,
      outputExcerpt: excerpt.substring(0, 500),
    };
  }
}
