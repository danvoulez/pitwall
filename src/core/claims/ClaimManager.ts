import { v4 as uuid } from 'uuid';
import { Claim } from './types';
import { PitwallEvent, TestDetectedEvent, ClaimDetectedEvent } from '../events/types';

const CLAIM_PATTERNS = [
  /(?:I've |I have )?(?:fixed|resolved|completed|done|finished|implemented|added|created|updated)/i,
  /(?:bug|issue|problem|error) (?:is |has been )?(?:fixed|resolved|addressed)/i,
  /(?:should|will) (?:work|pass|be fine|be good) now/i,
  /(?:all|everything) (?:looks |is )?(?:good|working|passing)/i,
  /ready (?:to|for) (?:commit|merge|review|deploy|ship)/i,
];

export class ClaimManager {
  private claims: Map<string, Claim> = new Map();
  private activeTestCommand = false;
  private lastTestCommandTime = 0;
  private testCommandWindowMs = 30000;

  detectClaims(
    text: string,
    source: 'driver' | 'race_engineer' | 'human',
    _sessionId: string,
    triggerEventId?: string
  ): { claims: Claim[]; events: ClaimDetectedEvent[] } {
    const detected: Claim[] = [];
    const events: ClaimDetectedEvent[] = [];
    const now = new Date().toISOString();

    for (const pattern of CLAIM_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const claimId = uuid();
        const claim: Claim = {
          id: claimId,
          text: match[0],
          source,
          evidenceStatus: 'unverified',
          supportingEvents: [],
          createdAt: now,
          createdAtEventId: triggerEventId,
        };
        this.claims.set(claim.id, claim);
        detected.push(claim);

        const event: ClaimDetectedEvent = {
          type: 'claim.detected',
          id: uuid(),
          sessionId: _sessionId,
          timestamp: now,
          text: match[0],
          source,
        };
        events.push(event);
      }
    }

    return { claims: detected, events };
  }

  markTestCommandActive(): void {
    this.activeTestCommand = true;
    this.lastTestCommandTime = Date.now();
  }

  isTestCommandActive(): boolean {
    if (!this.activeTestCommand) return false;
    if (Date.now() - this.lastTestCommandTime > this.testCommandWindowMs) {
      this.activeTestCommand = false;
      return false;
    }
    return true;
  }

  processEvent(event: PitwallEvent): void {
    if (event.type === 'command.detected') {
      const cmd = event.command.toLowerCase();
      if (/test|spec|check/.test(cmd)) {
        this.markTestCommandActive();
      }
    }

    if (event.type === 'test.detected') {
      const testEvent = event as TestDetectedEvent;

      for (const [, claim] of this.claims) {
        // Only associate evidence if:
        // 1. Claim is still unverified
        // 2. Test event occurred AFTER the claim was created
        // 3. A test command is/was recently active
        if (claim.evidenceStatus !== 'unverified') continue;
        if (event.timestamp <= claim.createdAt) continue;

        if (testEvent.status === 'passed') {
          claim.evidenceStatus = 'evidence_captured';
          claim.supportingEvents.push(event.id);
        } else if (testEvent.status === 'failed') {
          claim.evidenceStatus = 'contradicted';
          claim.supportingEvents.push(event.id);
        }
      }
    }
  }

  getClaims(): Claim[] {
    return Array.from(this.claims.values());
  }

  loadClaim(claim: Claim): void {
    this.claims.set(claim.id, claim);
  }

  updateClaim(id: string, update: Partial<Claim>): void {
    const claim = this.claims.get(id);
    if (claim) {
      Object.assign(claim, update);
    }
  }
}
