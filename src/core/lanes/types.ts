export type ShadowLane = 'scout' | 'reviewer' | 'test_monitor' | 'risk_monitor';

export type LaneObservation = {
  lane: ShadowLane;
  status: 'idle' | 'observing' | 'warning' | 'blocked';
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  relatedEvents: string[];
};
