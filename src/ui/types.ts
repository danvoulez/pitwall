export type SessionInfo = {
  sessionId: string;
  status: string;
};

export type SessionState = {
  session: {
    id: string;
    config: {
      repoPath: string;
      driver: { command: string; args: string[]; cwd: string };
      mission: { id: string; title: string; intent: string };
    };
    status: string;
    startedAt: string;
    endedAt?: string;
  };
  changedFiles: string[];
  diffStat: string;
  claims: Array<{
    id: string;
    text: string;
    source: string;
    evidenceStatus: string;
    supportingEvents: string[];
    createdAt: string;
  }>;
  gates: Array<{
    name: string;
    status: string;
    reason?: string;
  }>;
  laneObservations: Array<{
    lane: string;
    status: string;
    summary: string;
    confidence: string;
  }>;
  recentEvents: Array<{
    id: string;
    type: string;
    timestamp: string;
    [key: string]: unknown;
  }>;
};

export type PitwallEventWS = {
  id: string;
  type: string;
  sessionId: string;
  timestamp: string;
  data?: string;
  [key: string]: unknown;
};
