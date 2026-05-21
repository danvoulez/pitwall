import React from 'react';

interface LaneObservation {
  lane: string;
  status: string;
  summary: string;
  confidence: string;
}

interface FleetLanesProps {
  observations: LaneObservation[];
  onRefresh?: () => void;
}

const LANE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  scout: { label: 'SCOUT', icon: '🔍', color: '#58a6ff' },
  reviewer: { label: 'REVIEWER', icon: '📝', color: '#bc8cff' },
  test_monitor: { label: 'TEST MONITOR', icon: '🧪', color: '#7ee787' },
  risk_monitor: { label: 'RISK MONITOR', icon: '⚠️', color: '#d29922' },
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#484f58',
  observing: '#7ee787',
  warning: '#d29922',
  blocked: '#ff7b72',
};

export const FleetLanes: React.FC<FleetLanesProps> = ({ observations, onRefresh }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>FLEET LANES</span>
        {onRefresh && (
          <button onClick={onRefresh} style={styles.refreshBtn}>Refresh</button>
        )}
      </div>
      <div style={styles.lanes}>
        {observations.map((obs) => {
          const info = LANE_INFO[obs.lane] || { label: obs.lane, icon: '●', color: '#8b949e' };
          return (
            <div key={obs.lane} style={styles.lane}>
              <div style={styles.laneHeader}>
                <span style={styles.laneIcon}>{info.icon}</span>
                <span style={{ ...styles.laneName, color: info.color }}>{info.label}</span>
                <span style={{
                  ...styles.laneStatus,
                  color: STATUS_COLORS[obs.status] || '#8b949e',
                }}>
                  {obs.status}
                </span>
              </div>
              {obs.summary && (
                <div style={styles.laneSummary}>{obs.summary}</div>
              )}
            </div>
          );
        })}
        {observations.length === 0 && (
          <div style={styles.empty}>Shadow lanes idle — start a session to activate</div>
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
    padding: '2px 8px',
    fontSize: '9px',
    border: '1px solid #30363d',
    borderRadius: '4px',
    background: 'transparent',
    color: '#8b949e',
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
    padding: '8px 10px',
    background: '#0d1117',
  },
  laneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  laneIcon: {
    fontSize: '12px',
  },
  laneName: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    flex: 1,
  },
  laneStatus: {
    fontSize: '9px',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  laneSummary: {
    fontSize: '10px',
    color: '#8b949e',
    lineHeight: '1.3',
    maxHeight: '36px',
    overflow: 'hidden',
  },
  empty: {
    padding: '12px',
    color: '#484f58',
    fontSize: '11px',
    textAlign: 'center',
    width: '100%',
  },
};
