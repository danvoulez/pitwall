import React, { useState, useEffect, useCallback } from 'react';
import { PitwallEventWS } from '../types';

interface LaneObservation {
  lane: string;
  status: string;
  summary: string;
  confidence: string;
}

interface FleetLanesProps {
  observations: LaneObservation[];
  onRefresh?: () => void;
  onEvent?: (listener: (event: PitwallEventWS) => void) => () => void;
}

const LANE_INFO: Record<string, { label: string; color: string }> = {
  scout:        { label: 'SCOUT',        color: '#58a6ff' },
  reviewer:     { label: 'REVIEWER',     color: '#bc8cff' },
  test_monitor: { label: 'TEST',         color: '#7ee787' },
  risk_monitor: { label: 'RISK',         color: '#d29922' },
};

const STATUS_COLORS: Record<string, string> = {
  idle:      '#484f58',
  observing: '#58a6ff',
  warning:   '#d29922',
  blocked:   '#ff7b72',
};

function Spinner() {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontFamily: 'monospace', color: '#58a6ff' }}>{frames[frame]}</span>;
}

export const FleetLanes: React.FC<FleetLanesProps> = ({ observations: initialObs, onRefresh, onEvent }) => {
  // Live observations — updated in real-time from lane.update WS events
  const [live, setLive] = useState<Record<string, LaneObservation>>(() => {
    const map: Record<string, LaneObservation> = {};
    for (const obs of initialObs) map[obs.lane] = obs;
    return map;
  });

  // Sync from parent when poll-based state updates arrive
  useEffect(() => {
    setLive(prev => {
      const next = { ...prev };
      for (const obs of initialObs) {
        // Only update if not currently observing (don't overwrite spinner with stale idle)
        if (prev[obs.lane]?.status !== 'observing') {
          next[obs.lane] = obs;
        }
      }
      return next;
    });
  }, [initialObs]);

  // Subscribe to real-time lane.update events from WebSocket
  useEffect(() => {
    if (!onEvent) return;
    const unsubscribe = onEvent((event: PitwallEventWS) => {
      if (event.type !== 'lane.update') return;
      const { lane, status, summary, confidence } = event as PitwallEventWS & {
        lane: string; status: string; summary: string; confidence: string;
      };
      setLive(prev => ({
        ...prev,
        [lane]: { lane, status, summary, confidence },
      }));
    });
    return unsubscribe;
  }, [onEvent]);

  const lanes = ['scout', 'reviewer', 'test_monitor', 'risk_monitor'];

  const handleRefresh = useCallback(() => {
    // Mark all as observing immediately for instant feedback
    setLive(prev => {
      const next = { ...prev };
      for (const lane of lanes) {
        if (next[lane]) next[lane] = { ...next[lane], status: 'observing' };
      }
      return next;
    });
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>FLEET LANES</span>
        <button onClick={handleRefresh} style={styles.refreshBtn}>
          Analyze
        </button>
      </div>
      <div style={styles.lanes}>
        {lanes.map(laneKey => {
          const obs = live[laneKey];
          const info = LANE_INFO[laneKey] || { label: laneKey.toUpperCase(), color: '#8b949e' };
          const isObserving = obs?.status === 'observing';
          const isWarning = obs?.status === 'warning';

          return (
            <div
              key={laneKey}
              style={{
                ...styles.lane,
                ...(isWarning ? styles.laneWarning : {}),
              }}
            >
              <div style={styles.laneHeader}>
                <span style={{ ...styles.laneName, color: info.color }}>{info.label}</span>
                <span style={{ ...styles.laneStatus, color: STATUS_COLORS[obs?.status || 'idle'] }}>
                  {isObserving ? <Spinner /> : (obs?.status || 'idle')}
                </span>
              </div>
              {obs?.summary && !isObserving && (
                <div
                  style={{
                    ...styles.laneSummary,
                    color: isWarning ? '#d29922' : '#8b949e',
                  }}
                  title={obs.summary}
                >
                  {obs.summary.split('\n')[0].slice(0, 100)}
                  {obs.summary.length > 100 ? '…' : ''}
                </div>
              )}
              {isObserving && (
                <div style={{ ...styles.laneSummary, color: '#484f58', fontStyle: 'italic' }}>
                  analyzing...
                </div>
              )}
            </div>
          );
        })}
        {lanes.every(l => !live[l]) && (
          <div style={styles.empty}>Shadow lanes idle — click Analyze to run</div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0d1117',
    borderRadius: '6px',
    border: '1px solid #21262d',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#bc8cff',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
  },
  refreshBtn: {
    padding: '2px 10px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    border: '1px solid #bc8cff44',
    borderRadius: '4px',
    background: 'transparent',
    color: '#bc8cff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  lanes: {
    display: 'flex',
    gap: '1px',
    background: '#21262d',
  },
  lane: {
    flex: 1,
    padding: '7px 10px',
    background: '#0d1117',
    minWidth: 0,
  },
  laneWarning: {
    background: '#1a1200',
  },
  laneHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '3px',
  },
  laneName: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  laneStatus: {
    fontSize: '9px',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
  },
  laneSummary: {
    fontSize: '10px',
    lineHeight: '1.3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  empty: {
    padding: '12px',
    color: '#484f58',
    fontSize: '11px',
    textAlign: 'center' as const,
    width: '100%',
  },
};
