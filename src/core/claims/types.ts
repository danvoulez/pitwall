export type Claim = {
  id: string;
  text: string;
  source: 'driver' | 'race_engineer' | 'human';
  evidenceStatus:
    | 'unverified'
    | 'probe_proposed'
    | 'evidence_captured'
    | 'verified'
    | 'failed'
    | 'inconclusive';
  supportingEvents: string[];
  requiredEvidence?: string[];
  createdAt: string;
};
