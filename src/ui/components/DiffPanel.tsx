import React from 'react';
import { SessionState } from '../types';

interface DiffPanelProps {
  state: SessionState | null;
}

export const DiffPanel: React.FC<DiffPanelProps> = ({ state }) => {
  if (!state) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>DIFF</div>
        <div style={styles.empty}>No active session</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>DIFF</span>
        <span style={styles.fileCount}>{state.changedFiles.length} files</span>
      </div>
      <div style={styles.content}>
        {state.diffStat ? (
          <pre style={styles.diffStat}>{state.diffStat}</pre>
        ) : (
          <div style={styles.empty}>No changes detected</div>
        )}

        {state.changedFiles.length > 0 && (
          <div style={styles.fileList}>
            {state.changedFiles.map(f => (
              <div key={f} style={styles.file}>
                <span style={styles.fileStatus}>M</span>
                <span style={styles.fileName}>{f}</span>
              </div>
            ))}
          </div>
        )}
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
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#76e3ea',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
  },
  fileCount: {
    fontSize: '10px',
    color: '#484f58',
    fontWeight: 400,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  empty: {
    color: '#484f58',
    fontSize: '12px',
    textAlign: 'center',
    padding: '20px',
  },
  diffStat: {
    fontSize: '11px',
    color: '#c9d1d9',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    margin: 0,
    padding: '8px',
    background: '#161b22',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  file: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  fileStatus: {
    color: '#d29922',
    fontWeight: 700,
    width: '16px',
  },
  fileName: {
    color: '#c9d1d9',
    fontFamily: 'monospace',
  },
};
