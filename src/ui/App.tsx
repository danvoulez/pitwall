import React, { useState, useCallback } from 'react';
import { useSession } from './hooks/useSession';
import { TerminalVisor } from './components/TerminalVisor';
import { RaceRadio } from './components/RaceRadio';
import { MissionPanel } from './components/MissionPanel';
import { Timeline } from './components/Timeline';
import { FleetLanes } from './components/FleetLanes';
import { DiffPanel } from './components/DiffPanel';
import { StartSession } from './components/StartSession';

type Tab = 'visor' | 'diff' | 'timeline' | 'claims';

export const App: React.FC = () => {
  const {
    session,
    state,
    events,
    createSession,
    connectWs,
    sendTerminalInput,
    resizeTerminal,
    askEngineer,
    sendToDriver,
    interrupt,
    onEvent,
  } = useSession();

  const [activeTab, setActiveTab] = useState<Tab>('visor');

  const handleStart = useCallback(async (
    repoPath: string,
    command: string,
    args: string[],
    title: string,
    intent: string
  ) => {
    const info = await createSession(repoPath, command, args, title, intent);
    connectWs(info.sessionId);
  }, [createSession, connectWs]);

  if (!session) {
    return <StartSession onStart={handleStart} />;
  }

  return (
    <div style={styles.app}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.logoSmall}>PITWALL</div>
        <div style={styles.missionName}>
          Mission: {state?.session.config.mission.title || 'Loading...'}
        </div>
        <div style={styles.tabs}>
          {(['visor', 'diff', 'timeline', 'claims'] as Tab[]).map(tab => (
            <button
              key={tab}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={styles.statusDot}>
          <span style={{
            ...styles.dot,
            background: state?.session.status === 'running' ? '#7ee787' : '#d29922',
          }} />
          {state?.session.status || 'connecting'}
        </div>
      </div>

      {/* Main content */}
      <div style={styles.main}>
        {/* Left panel - Mission State */}
        <div style={styles.leftPanel}>
          <MissionPanel state={state} onInterrupt={interrupt} />
        </div>

        {/* Center - Terminal / Diff / etc */}
        <div style={styles.centerPanel}>
          {activeTab === 'visor' && (
            <TerminalVisor
              onInput={sendTerminalInput}
              onResize={resizeTerminal}
              onEvent={onEvent}
            />
          )}
          {activeTab === 'diff' && (
            <DiffPanel state={state} />
          )}
          {activeTab === 'timeline' && (
            <div style={styles.fullTimeline}>
              <Timeline events={events} />
            </div>
          )}
          {activeTab === 'claims' && (
            <div style={styles.claimsView}>
              <ClaimsView claims={state?.claims || []} />
            </div>
          )}
        </div>

        {/* Right panel - Race Radio */}
        <div style={styles.rightPanel}>
          <RaceRadio
            onAskEngineer={askEngineer}
            onSendToDriver={sendToDriver}
          />
        </div>
      </div>

      {/* Bottom bar - Timeline + Fleet Lanes */}
      <div style={styles.bottomBar}>
        <div style={styles.timelineStrip}>
          <Timeline events={events} />
        </div>
        <div style={styles.fleetStrip}>
          <FleetLanes observations={state?.laneObservations || []} />
        </div>
      </div>
    </div>
  );
};

// Inline Claims view
const ClaimsView: React.FC<{ claims: Array<{
  id: string;
  text: string;
  source: string;
  evidenceStatus: string;
  supportingEvents: string[];
  createdAt: string;
}> }> = ({ claims }) => {
  if (claims.length === 0) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#484f58' }}>
        No claims detected yet. Claims are detected when the driver asserts completion or success.
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Claim</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {claims.map(c => (
            <tr key={c.id}>
              <td style={tdStyle}>"{c.text}"</td>
              <td style={tdStyle}>{c.source}</td>
              <td style={{
                ...tdStyle,
                color: c.evidenceStatus === 'verified' ? '#7ee787'
                  : c.evidenceStatus === 'evidence_captured' ? '#58a6ff'
                  : c.evidenceStatus === 'failed' ? '#ff7b72'
                  : '#d29922',
                fontWeight: 700,
              }}>
                {c.evidenceStatus}
              </td>
              <td style={tdStyle}>{c.supportingEvents.length} event(s)</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '10px',
  fontWeight: 700,
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid #21262d',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '12px',
  color: '#c9d1d9',
  borderBottom: '1px solid #161b22',
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#010409',
    color: '#c9d1d9',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '6px 12px',
    background: '#0d1117',
    borderBottom: '1px solid #21262d',
    height: '38px',
    flexShrink: 0,
  },
  logoSmall: {
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '2px',
    background: 'linear-gradient(135deg, #ff7b72, #d29922, #7ee787, #58a6ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  missionName: {
    fontSize: '12px',
    color: '#8b949e',
    flex: 1,
  },
  tabs: {
    display: 'flex',
    gap: '2px',
  },
  tab: {
    padding: '4px 10px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    border: 'none',
    background: 'transparent',
    color: '#484f58',
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: '#21262d',
    color: '#f0f6fc',
  },
  statusDot: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#8b949e',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: '1px',
    background: '#21262d',
  },
  leftPanel: {
    width: '240px',
    flexShrink: 0,
    background: '#010409',
  },
  centerPanel: {
    flex: 1,
    background: '#010409',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    width: '320px',
    flexShrink: 0,
    background: '#010409',
    padding: '4px',
  },
  bottomBar: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderTop: '1px solid #21262d',
    maxHeight: '140px',
  },
  timelineStrip: {
    height: '50px',
  },
  fleetStrip: {
    borderTop: '1px solid #21262d',
  },
  fullTimeline: {
    flex: 1,
    overflow: 'auto',
  },
  claimsView: {
    flex: 1,
    overflow: 'auto',
    background: '#0d1117',
    borderRadius: '6px',
    border: '1px solid #21262d',
  },
};
