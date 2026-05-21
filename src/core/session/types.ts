export type DriverCommand = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
};

export type Mission = {
  id: string;
  title: string;
  intent: string;
};

export type SessionConfig = {
  repoPath: string;
  driver: DriverCommand;
  mission: Mission;
};

export type SessionState = {
  id: string;
  config: SessionConfig;
  status: 'starting' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: string;
  endedAt?: string;
};
