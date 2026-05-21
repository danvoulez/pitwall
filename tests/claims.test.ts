import { describe, it, expect } from 'vitest';
import { ClaimManager } from '../src/core/claims/ClaimManager';
import { TestDetectedEvent, CommandDetectedEvent } from '../src/core/events/types';
import { v4 as uuid } from 'uuid';

describe('ClaimManager — causality', () => {
  it('detects claims and returns claim.detected events', () => {
    const cm = new ClaimManager();
    const { claims, events } = cm.detectClaims(
      "I've fixed the refresh token bug",
      'driver',
      'sess-1',
      'evt-trigger-1'
    );

    expect(claims).toHaveLength(1);
    expect(claims[0].evidenceStatus).toBe('unverified');
    expect(claims[0].createdAtEventId).toBe('evt-trigger-1');

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('claim.detected');
  });

  it('associates passing test AFTER claim as evidence_captured', async () => {
    const cm = new ClaimManager();
    const { claims } = cm.detectClaims("I've fixed the bug", 'driver', 's1');

    // Small delay to ensure test event timestamp is after claim
    await new Promise(r => setTimeout(r, 10));

    const testEvent: TestDetectedEvent = {
      type: 'test.detected',
      id: uuid(),
      sessionId: 's1',
      timestamp: new Date().toISOString(),
      framework: 'jest',
      status: 'passed',
      outputExcerpt: 'Tests: 5 passed',
    };

    cm.processEvent(testEvent);
    expect(claims[0].evidenceStatus).toBe('evidence_captured');
    expect(claims[0].supportingEvents).toContain(testEvent.id);
  });

  it('marks claim as contradicted if test fails after claim', async () => {
    const cm = new ClaimManager();
    const { claims } = cm.detectClaims("Bug is fixed", 'driver', 's1');

    await new Promise(r => setTimeout(r, 10));

    const testEvent: TestDetectedEvent = {
      type: 'test.detected',
      id: uuid(),
      sessionId: 's1',
      timestamp: new Date().toISOString(),
      framework: 'jest',
      status: 'failed',
      outputExcerpt: 'Tests: 1 failed',
    };

    cm.processEvent(testEvent);
    expect(claims[0].evidenceStatus).toBe('contradicted');
  });

  it('does NOT associate test BEFORE claim as evidence', () => {
    const cm = new ClaimManager();

    // Test happens at time T
    const testEvent: TestDetectedEvent = {
      type: 'test.detected',
      id: uuid(),
      sessionId: 's1',
      timestamp: new Date(Date.now() - 1000).toISOString(),
      framework: 'jest',
      status: 'passed',
      outputExcerpt: 'Tests: 5 passed',
    };

    // Claim happens after
    const { claims } = cm.detectClaims("I've fixed it", 'driver', 's1');

    // Process the older test event
    cm.processEvent(testEvent);

    // Evidence must occur AFTER the claim — so this should remain unverified
    expect(claims[0].evidenceStatus).toBe('unverified');
  });

  it('tracks test commands to inform evidence scope', () => {
    const cm = new ClaimManager();

    const cmdEvent: CommandDetectedEvent = {
      type: 'command.detected',
      id: uuid(),
      sessionId: 's1',
      timestamp: new Date().toISOString(),
      command: 'npm test',
      confidence: 'high',
    };

    cm.processEvent(cmdEvent);
    expect(cm.isTestCommandActive()).toBe(true);
  });

  it('does not match non-claim text', () => {
    const cm = new ClaimManager();
    const { claims } = cm.detectClaims(
      'Looking at the auth module now',
      'driver',
      's1'
    );
    expect(claims).toHaveLength(0);
  });

  it('evidence_captured is NOT verified — distinction preserved', async () => {
    const cm = new ClaimManager();
    const { claims } = cm.detectClaims("Done with the fix", 'driver', 's1');

    await new Promise(r => setTimeout(r, 10));

    cm.processEvent({
      type: 'test.detected',
      id: uuid(),
      sessionId: 's1',
      timestamp: new Date().toISOString(),
      framework: 'jest',
      status: 'passed',
      outputExcerpt: 'Tests: 5 passed',
    });

    // evidence_captured, NOT verified
    expect(claims[0].evidenceStatus).toBe('evidence_captured');
    expect(claims[0].evidenceStatus).not.toBe('verified');
  });
});
