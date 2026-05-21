import { describe, it, expect } from 'vitest';
import { TestDetector } from '../src/core/detector/TestDetector';
import { CommandDetector } from '../src/core/detector/CommandDetector';

describe('TestDetector', () => {
  describe('jest patterns', () => {
    it('detects jest FAIL with test/spec file', () => {
      const d = new TestDetector('s1');
      const events = d.feed('FAIL src/auth.spec.ts\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
      expect(events[0].framework).toBe('jest');
    });

    it('detects jest Tests: N passed', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Tests: 5 passed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('passed');
      expect(events[0].framework).toBe('jest');
    });

    it('detects jest Tests: N failed', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Tests: 2 failed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
    });
  });

  describe('vitest patterns', () => {
    it('detects vitest pass', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Tests 12 passed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('passed');
      expect(events[0].framework).toBe('vitest');
    });

    it('detects vitest failure', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Tests 3 failed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
    });
  });

  describe('pytest patterns', () => {
    it('detects pytest passed', () => {
      const d = new TestDetector('s1');
      const events = d.feed('===== 3 passed in 1.2s =====\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('passed');
      expect(events[0].framework).toBe('pytest');
    });

    it('detects pytest FAILED', () => {
      const d = new TestDetector('s1');
      const events = d.feed('FAILED test_auth.py::test_refresh\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
      expect(events[0].framework).toBe('pytest');
    });
  });

  describe('go test patterns', () => {
    it('detects go test ok', () => {
      const d = new TestDetector('s1');
      const events = d.feed('ok  \tmypackage\t0.012s\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('passed');
      expect(events[0].framework).toBe('go test');
    });

    it('detects go test FAIL', () => {
      const d = new TestDetector('s1');
      const events = d.feed('--- FAIL: TestRefreshToken (0.00s)\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
      expect(events[0].framework).toBe('go test');
    });
  });

  describe('cargo test patterns', () => {
    it('detects cargo test pass', () => {
      const d = new TestDetector('s1');
      const events = d.feed('test result: ok. 5 passed; 0 failed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('passed');
      expect(events[0].framework).toBe('cargo test');
    });

    it('detects cargo test FAILED', () => {
      const d = new TestDetector('s1');
      const events = d.feed('test result: FAILED. 1 passed; 1 failed\n');
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('failed');
    });
  });

  describe('false positive prevention', () => {
    it('does NOT treat generic Error: as test failure', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Error: Cannot find module \'foo\'\n');
      expect(events).toHaveLength(0);
    });

    it('does NOT treat Traceback as test failure', () => {
      const d = new TestDetector('s1');
      const events = d.feed('Traceback (most recent call last):\n');
      expect(events).toHaveLength(0);
    });

    it('does NOT treat "passed" in a README as test evidence', () => {
      const d = new TestDetector('s1');
      const events = d.feed('All tests passed in the previous release.\n');
      expect(events).toHaveLength(0);
    });

    it('does NOT treat "FAIL" in plain text as test evidence', () => {
      const d = new TestDetector('s1');
      const events = d.feed('This feature might FAIL under load.\n');
      expect(events).toHaveLength(0);
    });

    it('does NOT treat terminal noise as test output', () => {
      const d = new TestDetector('s1');
      const events = d.feed('$ ls -la\ntotal 32\ndrwxr-xr-x 4 user user 4096 Error: something\n');
      expect(events).toHaveLength(0);
    });
  });
});

describe('CommandDetector', () => {
  it('detects shell prompt commands', () => {
    const d = new CommandDetector('s1');
    const events = d.feed('$ npm test\n');
    expect(events).toHaveLength(1);
    expect(events[0].command).toBe('npm test');
  });

  it('detects various prompt styles', () => {
    const d = new CommandDetector('s1');
    expect(d.feed('% git diff\n')).toHaveLength(1);
    expect(d.feed('> python manage.py migrate\n')).toHaveLength(1);
  });

  it('does NOT detect non-command lines', () => {
    const d = new CommandDetector('s1');
    expect(d.feed('just some output text\n')).toHaveLength(0);
    expect(d.feed('  indented output\n')).toHaveLength(0);
  });
});
