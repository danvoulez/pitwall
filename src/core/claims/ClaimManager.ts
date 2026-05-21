import { v4 as uuid } from 'uuid';
import { Claim } from './types';
import { PitwallEvent, TestDetectedEvent } from '../events/types';

const CLAIM_PATTERNS = [
  /(?:I've |I have )?(?:fixed|resolved|completed|done|finished|implemented|added|created|updated)/i,
  /(?:bug|issue|problem|error) (?:is |has been )?(?:fixed|resolved|addressed)/i,
  /(?:should|will) (?:work|pass|be fine|be good) now/i,
  /(?:all|everything) (?:looks |is )?(?:good|working|passing)/i,
  /ready (?:to|for) (?:commit|merge|review|deploy|ship)/i,
];

export class ClaimManager {
  private claims: Map<string, Claim> = new Map();

  detectClaims(text: string, source: 'driver' | 'race_engineer' | 'human', sessionId: string): Claim[] {
    const detected: Claim[] = [];

    for (const pattern of CLAIM_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const claim: Claim = {
          id: uuid(),
          text: match[0],
          source,
          evidenceStatus: 'unverified',
          supportingEvents: [],
          createdAt: new Date().toISOString(),
        };
        this.claims.set(claim.id, claim);
        detected.push(claim);
      }
    }

    return detected;
  }

  processEvent(event: PitwallEvent): void {
    if (event.type === 'test.detected') {
      const testEvent = event as TestDetectedEvent;
      // Associate test results with unverified claims
      for (const [, claim] of this.claims) {
        if (claim.evidenceStatus === 'unverified') {
          if (testEvent.status === 'passed') {
            claim.evidenceStatus = 'evidence_captured';
            claim.supportingEvents.push(event.id);
          } else if (testEvent.status === 'failed') {
            claim.evidenceStatus = 'failed';
            claim.supportingEvents.push(event.id);
          }
        }
      }
    }
  }

  getClaims(): Claim[] {
    return Array.from(this.claims.values());
  }

  updateClaim(id: string, update: Partial<Claim>): void {
    const claim = this.claims.get(id);
    if (claim) {
      Object.assign(claim, update);
    }
  }
}
