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

interface DriverPreset {
  label: string;
  command: string;
  args: string[];
  dangerous?: boolean;
  dangerWarning?: string;
}

const PRESETS: DriverPreset[] = [
  { label: 'Bash', command: 'bash', args: [] },
  { label: 'Claude Code', command: 'claude', args: [] },
  { label: 'Codex', command: 'codex', args: [] },
  {
    label: 'Claude Code (UNSAFE)',
    command: 'claude',
    args: ['--dangerously-skip-permissions'],
    dangerous: true,
    dangerWarning: 'This disables all Claude Code permission prompts. The agent will execute commands, edit files, and make changes without asking for confirmation. Only use this if you trust the agent and understand the risks.',
  },
  { label: 'Custom command', command: '', args: [] },
];

export const StartSession: React.FC<StartSessionProps> = ({ onStart }) => {
  const [repoPath, setRepoPath] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customCommand, setCustomCommand] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionIntent, setMissionIntent] = useState('');
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  const currentPreset = PRESETS[selectedPreset];
  const isCustom = currentPreset.command === '';
  const isDangerous = currentPreset.dangerous === true;
  const canStart = repoPath && missionTitle && (!isDangerous || dangerConfirmed) && (!isCustom || customCommand);

  const handlePresetSelect = (i: number) => {
    setSelectedPreset(i);
    setDangerConfirmed(false);
  };

  const handleStart = () => {
    if (!canStart) return;
    const cmd = isCustom && customCommand
      ? customCommand.split(' ')[0]
      : currentPreset.command;
    const args = isCustom && customCommand
      ? customCommand.split(' ').slice(1)
      : currentPreset.args;

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
                    ...(preset.dangerous ? styles.presetBtnDanger : {}),
                    ...(selectedPreset === i && preset.dangerous ? styles.presetBtnDangerActive : {}),
                  }}
                  onClick={() => handlePresetSelect(i)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {isDangerous && currentPreset.dangerWarning && (
              <div style={styles.dangerBox}>
                <div style={styles.dangerTitle}>WARNING: Unsafe Mode</div>
                <div style={styles.dangerText}>{currentPreset.dangerWarning}</div>
                <label style={styles.dangerCheck}>
                  <input
                    type="checkbox"
                    checked={dangerConfirmed}
                    onChange={(e) => setDangerConfirmed(e.target.checked)}
                  />
                  <span>I understand the risks and want to proceed</span>
                </label>
              </div>
            )}

            {isCustom && (
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
              opacity: canStart ? 1 : 0.5,
            }}
            onClick={handleStart}
            disabled={!canStart}
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
  presetBtnDanger: {
    borderColor: '#6e3630',
    color: '#ff7b72',
  },
  presetBtnDangerActive: {
    background: '#6e3630',
    borderColor: '#ff7b72',
    color: '#fff',
  },
  dangerBox: {
    marginTop: '8px',
    padding: '12px',
    background: '#1c1007',
    border: '1px solid #6e3630',
    borderRadius: '6px',
  },
  dangerTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#ff7b72',
    marginBottom: '6px',
  },
  dangerText: {
    fontSize: '11px',
    color: '#d29922',
    lineHeight: '1.4',
    marginBottom: '8px',
  },
  dangerCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#c9d1d9',
    cursor: 'pointer',
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
