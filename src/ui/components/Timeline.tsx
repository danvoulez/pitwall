import React from 'react';
import { PitwallEventWS } from '../types';

interface TimelineProps {
  events: PitwallEventWS[];
}

const EVENT_ICONS: Record<string, string> = {
  'mission.state': '🏁',
  'pty.output': '📺',
  'pty.input': '⌨️',
  'file.changed': '📄',
  'git.diff.snapshot': '📊',
  'command.detected': '💻',
  'test.detected': '🧪',
  'claim.detected': '📢',
  'risk.detected': '⚠️',
  'engineer.message': '📡',
};

const EVENT_COLORS: Record<string, string> = {
  'mission.state': '#58a6ff',
  'pty.output': '#484f58',
  'pty.input': '#bc8cff',
  'file.changed': '#d29922',
  'git.diff.snapshot': '#76e3ea',
  'command.detected': '#7ee787',
  'test.detected': '#ff7b72',
  'claim.detected': '#d29922',
  'risk.detected': '#ff7b72',
  'engineer.message': '#7ee787',
};

function formatEventSummary(event: PitwallEventWS): string {
  switch (event.type) {
    case 'mission.state':
      return `Mission ${(event as { status?: string }).status || 'updated'}`;
    case 'file.changed':
      return `${(event as { change?: string }).change}: ${(event as { path?: string }).path}`;
    case 'command.detected':
      return `$ ${(event as { command?: string }).command}`;
    case 'test.detected': {
      const te = event as { framework?: string; status?: string };
      return `${te.framework}: ${te.status}`;
    }
    case 'claim.detected':
      return `"${(event as { text?: string }).text}"`;
    case 'risk.detected':
      return `[${(event as { level?: string }).level}] ${(event as { description?: string }).description}`;
    case 'engineer.message':
      return (event as { content?: string }).content?.substring(0, 80) || 'message';
    case 'git.diff.snapshot': {
      const gd = event as { files?: Array<{ path: string }> };
      return `${gd.files?.length || 0} files changed`;
    }
    default:
      return event.type;
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  // Filter out high-frequency pty.output events
  const significantEvents = events.filter(e =>
    e.type !== 'pty.output' && e.type !== 'pty.input'
  );

  const displayEvents = significantEvents.slice(-30);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>TIMELINE</span>
        <span style={styles.count}>{significantEvents.length} events</span>
      </div>
      <div style={styles.events}>
        {displayEvents.length === 0 && (
          <div style={styles.empty}>Waiting for events...</div>
        )}
        {displayEvents.map((event) => (
          <div key={event.id} style={styles.event}>
            <span style={styles.time}>{formatTime(event.timestamp)}</span>
            <span style={{
              ...styles.icon,
              color: EVENT_COLORS[event.type] || '#8b949e',
            }}>
              {EVENT_ICONS[event.type] || '●'}
            </span>
            <span style={{
              ...styles.summary,
              color: EVENT_COLORS[event.type] || '#8b949e',
            }}>
              {formatEventSummary(event)}
            </span>
          </div>
        ))}
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
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
  },
  title: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#d29922',
  },
  count: {
    fontSize: '10px',
    color: '#484f58',
  },
  events: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    gap: '0',
    padding: '6px 8px',
    whiteSpace: 'nowrap',
  },
  empty: {
    color: '#484f58',
    fontSize: '11px',
    padding: '4px 8px',
  },
  event: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRight: '1px solid #21262d',
    flexShrink: 0,
  },
  time: {
    fontSize: '9px',
    color: '#484f58',
    fontFamily: 'monospace',
  },
  icon: {
    fontSize: '10px',
  },
  summary: {
    fontSize: '10px',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
