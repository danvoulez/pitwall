export type GateName = 'commit' | 'migration' | 'dependency' | 'deploy' | 'destructive_command';

export type Gate = {
  name: GateName;
  status: 'open' | 'warn' | 'locked';
  reason?: string;
};
