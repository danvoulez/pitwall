import React, { useState } from 'react';

interface StartSessionProps {
  onStart: (
    repoPath: string,
    command: string,
    args: string[],
    missionTitle: string,
    missionIntent: string
  ) => void;
}

const PRESETS = [
  { label: 'Claude Code', command: 'claude', args: [] },
  { label: 'Claude Code (skip permissions)', command: 'claude', args: ['--dangerously-skip-permissions'] },
  { label: 'Codex', command: 'codex', args: [] },
  { label: 'Custom shell', command: 'bash', args: [] },
];

export const StartSession: React.FC<StartSessionProps> = ({ onStart }) => {
  const [repoPath, setRepoPath] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customCommand, setCustomCommand] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionIntent, setMissionIntent] = useState('');

  const handleStart = () => {
    if (!repoPath || !missionTitle) return;
    const preset = PRESETS[selectedPreset];
    const cmd = preset.command === 'bash' && customCommand
      ? customCommand.split(' ')[0]
      : preset.command;
    const args = preset.command === 'bash' && customCommand
      ? customCommand.split(' ').slice(1)
      : preset.args;

    onStart(repoPath, cmd, args, missionTitle, missionIntent || missionTitle);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.logo}>PITWALL</div>
          <div style={styles.subtitle}>Mission Control for AI Coding Agents</div>
        </div>

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Repository Path</label>
            <input
              style={styles.input}
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/dan/my-project"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Driver</label>
            <div style={styles.presets}>
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.presetBtn,
                    ...(selectedPreset === i ? styles.presetBtnActive : {}),
                  }}
                  onClick={() => setSelectedPreset(i)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedPreset === 3 && (
              <input
                style={{ ...styles.input, marginTop: '6px' }}
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. node my-agent.js"
              />
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mission Title</label>
            <input
              style={styles.input}
              value={missionTitle}
              onChange={(e) => setMissionTitle(e.target.value)}
              placeholder="e.g. Fix refresh token bug"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mission Intent (optional)</label>
            <textarea
              style={{ ...styles.input, minHeight: '60px' }}
              value={missionIntent}
              onChange={(e) => setMissionIntent(e.target.value)}
              placeholder="e.g. Find and fix the failing refresh token behavior without unrelated refactors."
            />
          </div>

          <button
            style={{
              ...styles.startBtn,
              opacity: (!repoPath || !missionTitle) ? 0.5 : 1,
            }}
            onClick={handleStart}
            disabled={!repoPath || !missionTitle}
          >
            START MISSION
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.85)',
    zIndex: 1000,
  },
  modal: {
    width: '500px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    padding: '30px 30px 20px',
    textAlign: 'center',
    borderBottom: '1px solid #21262d',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '4px',
    color: '#f0f6fc',
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #ff7b72, #d29922, #7ee787, #58a6ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
    letterSpacing: '1px',
  },
  form: {
    padding: '20px 30px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '8px 12px',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#c9d1d9',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical' as const,
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  presetBtn: {
    padding: '6px 12px',
    fontSize: '11px',
    border: '1px solid #30363d',
    borderRadius: '6px',
    background: '#161b22',
    color: '#8b949e',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  presetBtnActive: {
    background: '#1f6feb',
    borderColor: '#1f6feb',
    color: '#fff',
  },
  startBtn: {
    padding: '12px',
    background: 'linear-gradient(135deg, #238636, #1f6feb)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '1px',
    marginTop: '8px',
  },
};
