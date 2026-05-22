import { Claim } from '../claims/types';

export type Risk = {
  id: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  relatedEvents: string[];
};

export type MissionPacket = {
  mission: {
    id: string;
    title: string;
    userIntent: string;
    currentStatus: string;
  };
  terminal: {
    recentOutput: string;
    recentInputs: string[];
  };
  repo: {
    cwd: string;
    changedFiles: string[];
    diffStat: string;
    diffPreview: string;
  };
  tests: {
    recentCommands: string[];
    recentResults: string[];
  };
  claims: Claim[];
  risks: Risk[];
  openQuestions: string[];
};

export type RadioMessage = {
  role: 'user' | 'engineer';
  content: string;
  timestamp: string;
};
