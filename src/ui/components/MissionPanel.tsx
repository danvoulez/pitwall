import React from 'react';
import { SessionState } from '../types';

interface MissionPanelProps {
  state: SessionState | null;
  onInterrupt: () => void;
}

export const MissionPanel: React.FC<MissionPanelProps> = ({ state, onInterrupt }) => {
  if (!state) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>MISSION</div>
        <div style={styles.empty}>No active session</div>
      </div>
    );
  }

  const { session, changedFiles, claims, gates } = state;
  const riskLevel = gates.some(g => g.status === 'locked') ? 'high'
    : gates.some(g => g.status === 'warn') ? 'medium'
    : 'low';

  const testEvents = state.recentEvents.filter(e => e.type === 'test.detected');
  const lastTest = testEvents[testEvents.length - 1];
  const testStatus = lastTest
    ? (lastTest as { status?: string }).status || 'unknown'
    : 'none';

  return (
    <div style={styles.container}>
      <div style={styles.header}>MISSION STATE</div>

      <div style={styles.section}>
        <div style={styles.missionTitle}>{session.config.mission.title}</div>
        <div style={styles.intent}>{session.config.mission.intent}</div>
      </div>

      <div style={styles.grid}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Status</div>
          <div style={{
            ...styles.statValue,
            color: session.status === 'running' ? '#7ee787' : '#d29922',
          }}>
            {session.status}
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Risk</div>
          <div style={{
            ...styles.statValue,
            color: riskLevel === 'high' ? '#ff7b72'
              : riskLevel === 'medium' ? '#d29922'
              : '#7ee787',
          }}>
            {riskLevel}
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Files touched</div>
          <div style={styles.statValue}>{changedFiles.length}</div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Tests</div>
          <div style={{
            ...styles.statValue,
            color: testStatus === 'passed' ? '#7ee787'
              : testStatus === 'failed' ? '#ff7b72'
              : '#8b949e',
          }}>
            {testStatus}
          </div>
        </div>
      </div>

      {changedFiles.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Changed Files</div>
          {changedFiles.slice(0, 8).map(f => (
            <div key={f} style={styles.file}>{f}</div>
          ))}
          {changedFiles.length > 8 && (
            <div style={styles.more}>+{changedFiles.length - 8} more</div>
          )}
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Gates</div>
        {gates.map(gate => (
          <div key={gate.name} style={styles.gate}>
            <span style={{
              ...styles.gateIndicator,
              background: gate.status === 'open' ? '#238636'
                : gate.status === 'warn' ? '#d29922'
                : '#da3633',
            }} />
            <span style={styles.gateName}>{gate.name}</span>
            <span style={styles.gateStatus}>{gate.status}</span>
          </div>
        ))}
      </div>

      {claims.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Claims</div>
          {claims.slice(0, 5).map(claim => (
            <div key={claim.id} style={styles.claim}>
              <div style={styles.claimText}>"{claim.text}"</div>
              <div style={{
                ...styles.claimStatus,
                color: claim.evidenceStatus === 'verified' ? '#7ee787'
                  : claim.evidenceStatus === 'evidence_captured' ? '#58a6ff'
                  : claim.evidenceStatus === 'failed' ? '#ff7b72'
                  : '#d29922',
              }}>
                {claim.evidenceStatus}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.actions}>
        <button style={styles.interruptBtn} onClick={onInterrupt}>
          PAUSE / INTERRUPT
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0d1117',
    borderRadius: '6px',
    border: '1px solid #21262d',
    overflow: 'auto',
  },
  header: {
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#58a6ff',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
  },
  empty: {
    padding: '20px',
    color: '#484f58',
    fontSize: '12px',
    textAlign: 'center',
  },
  section: {
    padding: '8px 12px',
    borderBottom: '1px solid #21262d',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  missionTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f0f6fc',
    marginBottom: '4px',
  },
  intent: {
    fontSize: '11px',
    color: '#8b949e',
    lineHeight: '1.4',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1px',
    background: '#21262d',
    margin: '0',
  },
  stat: {
    padding: '8px 12px',
    background: '#0d1117',
  },
  statLabel: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#484f58',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c9d1d9',
  },
  file: {
    fontSize: '11px',
    color: '#c9d1d9',
    padding: '2px 0',
    fontFamily: 'monospace',
  },
  more: {
    fontSize: '10px',
    color: '#484f58',
    marginTop: '4px',
  },
  gate: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 0',
    fontSize: '11px',
  },
  gateIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  gateName: {
    color: '#c9d1d9',
    flex: 1,
  },
  gateStatus: {
    color: '#8b949e',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  claim: {
    padding: '4px 0',
    borderBottom: '1px solid #161b22',
  },
  claimText: {
    fontSize: '11px',
    color: '#c9d1d9',
    fontStyle: 'italic',
  },
  claimStatus: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  actions: {
    padding: '8px 12px',
    marginTop: 'auto',
  },
  interruptBtn: {
    width: '100%',
    padding: '8px',
    background: '#da3633',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
  },
};
