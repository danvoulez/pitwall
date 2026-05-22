import React, { useState } from 'react';
import { SessionState } from '../types';

interface DiffPanelProps {
  state: SessionState | null;
}

// File status badge colors
const STATUS_COLOR: Record<string, string> = {
  A: '#7ee787',
  M: '#d29922',
  D: '#ff7b72',
  R: '#58a6ff',
};

function DiffLine({ line }: { line: string }) {
  if (line.startsWith('@@')) {
    return <div style={{ ...lineStyle, color: '#76e3ea', background: '#0d2233' }}>{line}</div>;
  }
  if (line.startsWith('+++') || line.startsWith('---')) {
    return <div style={{ ...lineStyle, color: '#8b949e' }}>{line}</div>;
  }
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
    return <div style={{ ...lineStyle, color: '#8b949e', fontStyle: 'italic' }}>{line}</div>;
  }
  if (line.startsWith('+')) {
    return <div style={{ ...lineStyle, color: '#7ee787', background: '#0d2a0d' }}>{line}</div>;
  }
  if (line.startsWith('-')) {
    return <div style={{ ...lineStyle, color: '#ff7b72', background: '#2d0d0d' }}>{line}</div>;
  }
  return <div style={{ ...lineStyle, color: '#c9d1d9' }}>{line}</div>;
}

// Split a raw unified diff into per-file sections
function splitByFile(diff: string): Array<{ header: string; lines: string[] }> {
  const sections: Array<{ header: string; lines: string[] }> = [];
  let current: { header: string; lines: string[] } | null = null;

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current) sections.push(current);
      const match = line.match(/diff --git a\/.+ b\/(.+)/);
      current = { header: match?.[1] || line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function inferFileStatus(lines: string[]): string {
  for (const l of lines) {
    if (l.startsWith('new file')) return 'A';
    if (l.startsWith('deleted file')) return 'D';
    if (l.startsWith('rename ')) return 'R';
  }
  return 'M';
}

export const DiffPanel: React.FC<DiffPanelProps> = ({ state }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!state) {
    return (
      <div style={styles.container}>
        <div style={styles.header}><span>DIFF</span></div>
        <div style={styles.empty}>No active session</div>
      </div>
    );
  }

  const hasDiff = state.diffPreview && state.diffPreview.trim().length > 0;
  const sections = hasDiff ? splitByFile(state.diffPreview) : [];

  const toggle = (header: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>DIFF</span>
        <span style={styles.meta}>
          {sections.length} file{sections.length !== 1 ? 's' : ''}
          {state.diffStat && (
            <span style={styles.statSummary}>
              {' · '}
              {state.diffStat
                .split('\n')
                .find(l => /changed|insertion|deletion/i.test(l))
                ?.trim() || ''}
            </span>
          )}
        </span>
      </div>

      <div style={styles.content}>
        {!hasDiff && (
          <div style={styles.empty}>No uncommitted changes detected</div>
        )}

        {sections.map(({ header, lines }) => {
          const status = inferFileStatus(lines);
          const isOpen = expanded.has(header);
          const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
          const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

          return (
            <div key={header} style={styles.fileBlock}>
              <div
                style={styles.fileHeader}
                onClick={() => toggle(header)}
              >
                <span style={{ ...styles.statusBadge, color: STATUS_COLOR[status] || '#8b949e' }}>
                  {status}
                </span>
                <span style={styles.fileName}>{header}</span>
                <span style={styles.stats}>
                  {additions > 0 && <span style={styles.additions}>+{additions}</span>}
                  {deletions > 0 && <span style={styles.deletions}>-{deletions}</span>}
                </span>
                <span style={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
              </div>

              {isOpen && (
                <div style={styles.diffBody}>
                  {lines.map((line, i) => (
                    <DiffLine key={i} line={line} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const lineStyle: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: '11px',
  lineHeight: '1.5',
  padding: '0 8px',
  whiteSpace: 'pre',
  display: 'block',
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
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#76e3ea',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
    flexShrink: 0,
  },
  meta: {
    fontSize: '10px',
    color: '#484f58',
    fontWeight: 400,
  },
  statSummary: {
    color: '#8b949e',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    padding: '4px',
  },
  empty: {
    color: '#484f58',
    fontSize: '12px',
    textAlign: 'center',
    padding: '20px',
  },
  fileBlock: {
    border: '1px solid #21262d',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  fileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    background: '#161b22',
    cursor: 'pointer',
    userSelect: 'none',
  },
  statusBadge: {
    fontWeight: 700,
    fontSize: '11px',
    width: '14px',
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    fontSize: '11px',
    color: '#c9d1d9',
    fontFamily: "'SF Mono', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stats: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  additions: {
    fontSize: '10px',
    color: '#7ee787',
    fontWeight: 700,
  },
  deletions: {
    fontSize: '10px',
    color: '#ff7b72',
    fontWeight: 700,
  },
  chevron: {
    fontSize: '10px',
    color: '#484f58',
    flexShrink: 0,
  },
  diffBody: {
    background: '#0d1117',
    overflow: 'auto',
    maxHeight: '400px',
  },
};
