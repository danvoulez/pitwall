import { v4 as uuid } from 'uuid';
import { TestDetectedEvent } from '../events/types';

type TestFramework = 'jest' | 'vitest' | 'pytest' | 'go test' | 'cargo test' | 'unknown';

interface TestPattern {
  framework: TestFramework;
  commandPattern?: RegExp;
  passPatterns: RegExp[];
  failPatterns: RegExp[];
}

const TEST_PATTERNS: TestPattern[] = [
  {
    framework: 'jest',
    commandPattern: /jest|npx jest|pnpm test|npm test|yarn test/,
    passPatterns: [
      /Tests:\s+\d+ passed/,
      /Test Suites:\s+\d+ passed/,
      /PASS\s+\S+/,
    ],
    failPatterns: [
      /Tests:\s+\d+ failed/,
      /Test Suites:\s+\d+ failed/,
      /FAIL\s+\S+/,
    ],
  },
  {
    framework: 'vitest',
    commandPattern: /vitest|npx vitest/,
    passPatterns: [
      /Tests\s+\d+ passed/,
      /✓|√/,
    ],
    failPatterns: [
      /Tests\s+\d+ failed/,
      /✗|×|FAIL/,
    ],
  },
  {
    framework: 'pytest',
    commandPattern: /pytest|python -m pytest/,
    passPatterns: [
      /\d+ passed/,
      /PASSED/,
    ],
    failPatterns: [
      /\d+ failed/,
      /FAILED/,
      /ERRORS/,
    ],
  },
  {
    framework: 'go test',
    commandPattern: /go test/,
    passPatterns: [/^ok\s+/m, /PASS/],
    failPatterns: [/^FAIL\s+/m, /--- FAIL/],
  },
  {
    framework: 'cargo test',
    commandPattern: /cargo test/,
    passPatterns: [/test result: ok/],
    failPatterns: [/test result: FAILED/, /failures:/],
  },
];

const GENERIC_FAIL_PATTERNS = [
  /Error:/i,
  /Traceback \(most recent call last\)/,
  /AssertionError/,
  /AssertError/,
  /FAIL/,
  /failed/,
  /panic:/,
];

const GENERIC_PASS_PATTERNS = [
  /All tests passed/i,
  /PASS/,
  /passed/,
  /✓ All/,
];

export class TestDetector {
  private sessionId: string;
  private buffer: string = '';
  private onTest: ((event: TestDetectedEvent) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setHandler(handler: (event: TestDetectedEvent) => void): void {
    this.onTest = handler;
  }

  feed(data: string): TestDetectedEvent[] {
    this.buffer += data;
    const events: TestDetectedEvent[] = [];

    // Keep last ~4000 chars to detect multi-line test output
    if (this.buffer.length > 8000) {
      this.buffer = this.buffer.slice(-4000);
    }

    const stripped = this.buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    for (const tp of TEST_PATTERNS) {
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
    }

    // Generic detection
    for (const pattern of GENERIC_FAIL_PATTERNS) {
      if (pattern.test(stripped)) {
        const match = stripped.match(pattern);
        if (match) {
          const event = this.createEvent('unknown', 'failed', match[0]);
          events.push(event);
          this.onTest?.(event);
          this.buffer = '';
          return events;
        }
      }
    }

    for (const pattern of GENERIC_PASS_PATTERNS) {
      if (pattern.test(stripped)) {
        const match = stripped.match(pattern);
        if (match) {
          const event = this.createEvent('unknown', 'passed', match[0]);
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
