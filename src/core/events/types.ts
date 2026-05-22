export type PtyOutputEvent = {
  type: 'pty.output';
  id: string;
  sessionId: string;
  timestamp: string;
  data: string;
};

export type PtyInputEvent = {
  type: 'pty.input';
  id: string;
  sessionId: string;
  timestamp: string;
  source: 'human' | 'race_engineer';
  data: string;
};

export type FileChangedEvent = {
  type: 'file.changed';
  id: string;
  sessionId: string;
  timestamp: string;
  path: string;
  change: 'created' | 'modified' | 'deleted';
};

export type GitDiffSnapshot = {
  type: 'git.diff.snapshot';
  id: string;
  sessionId: string;
  timestamp: string;
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions?: number;
    deletions?: number;
    diffPreview?: string;
  }>;
};

export type CommandDetectedEvent = {
  type: 'command.detected';
  id: string;
  sessionId: string;
  timestamp: string;
  command: string;
  confidence: 'low' | 'medium' | 'high';
};

export type TestDetectedEvent = {
  type: 'test.detected';
  id: string;
  sessionId: string;
  timestamp: string;
  command?: string;
  framework?: 'jest' | 'vitest' | 'pytest' | 'go test' | 'cargo test' | 'unknown';
  status: 'passed' | 'failed' | 'running' | 'unknown';
  outputExcerpt: string;
};

export type ClaimDetectedEvent = {
  type: 'claim.detected';
  id: string;
  sessionId: string;
  timestamp: string;
  text: string;
  source: 'driver' | 'race_engineer' | 'human';
};

export type RiskDetectedEvent = {
  type: 'risk.detected';
  id: string;
  sessionId: string;
  timestamp: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
};

export type EngineerMessageEvent = {
  type: 'engineer.message';
  id: string;
  sessionId: string;
  timestamp: string;
  role: 'user' | 'engineer';
  content: string;
};

export type MissionStateEvent = {
  type: 'mission.state';
  id: string;
  sessionId: string;
  timestamp: string;
  status: 'starting' | 'running' | 'paused' | 'completed' | 'failed';
};

export type LaneUpdateEvent = {
  type: 'lane.update';
  id: string;
  sessionId: string;
  timestamp: string;
  lane: string;
  status: 'idle' | 'observing' | 'warning' | 'blocked';
  summary: string;
  confidence: string;
};

export type PitwallEvent =
  | PtyOutputEvent
  | PtyInputEvent
  | FileChangedEvent
  | GitDiffSnapshot
  | CommandDetectedEvent
  | TestDetectedEvent
  | ClaimDetectedEvent
  | RiskDetectedEvent
  | EngineerMessageEvent
  | MissionStateEvent
  | LaneUpdateEvent;
