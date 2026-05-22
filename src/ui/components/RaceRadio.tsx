import React, { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';

interface RadioMessage {
  role: 'user' | 'engineer';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

interface RaceRadioProps {
  onAskEngineer: (message: string) => Promise<string>;
  onSendToDriver: (instruction: string) => Promise<string>;
}

export const RaceRadio: React.FC<RaceRadioProps> = ({ onAskEngineer, onSendToDriver }) => {
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'ask' | 'driver'>('ask');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');

    setMessages(prev => [...prev, {
      role: 'user',
      content: mode === 'driver' ? `**[TO DRIVER]** ${text}` : text,
      timestamp: new Date().toISOString(),
    }]);

    // Add streaming placeholder
    const streamingId = Date.now();
    setMessages(prev => [...prev, {
      role: 'engineer',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    }]);

    setLoading(true);
    try {
      const response = mode === 'ask'
        ? await onAskEngineer(text)
        : await onSendToDriver(text);

      // Simulate character streaming for UX feel
      let i = 0;
      const chunk = Math.max(1, Math.floor(response.length / 40));
      const interval = setInterval(() => {
        i = Math.min(i + chunk, response.length);
        setMessages(prev => prev.map((m, idx) =>
          idx === prev.length - 1 && m.streaming
            ? { ...m, content: response.slice(0, i), streaming: i < response.length }
            : m
        ));
        if (i >= response.length) clearInterval(interval);
      }, 16);

      // Ensure final content is complete
      await new Promise(r => setTimeout(r, (response.length / chunk) * 16 + 50));
      setMessages(prev => prev.map((m, idx) =>
        idx === prev.length - 1 ? { ...m, content: response, streaming: false } : m
      ));
      clearInterval(interval);

    } catch {
      setMessages(prev => prev.map((m, idx) =>
        idx === prev.length - 1 && m.streaming
          ? { ...m, content: '⚠️ Failed to reach Race Engineer.', streaming: false }
          : m
      ));
    }
    setLoading(false);
    void streamingId;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>RACE RADIO</span>
        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'ask' ? styles.modeBtnActive : {}) }}
            onClick={() => setMode('ask')}
          >
            Ask Engineer
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'driver' ? styles.modeBtnDriverActive : {}) }}
            onClick={() => setMode('driver')}
          >
            Send to Driver
          </button>
        </div>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            {mode === 'ask'
              ? 'Ask the Race Engineer about the session state...'
              : 'Send instructions to the driver agent...'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.engineerMessage),
            }}
          >
            <div style={styles.messageRole}>
              {msg.role === 'user' ? 'Dan' : 'Engineer'}
            </div>
            {msg.role === 'engineer' ? (
              <div style={styles.mdWrapper}>
                <Streamdown mode={msg.streaming ? 'streaming' : 'static'}>
                  {msg.content || (msg.streaming ? ' ' : '')}
                </Streamdown>
              </div>
            ) : (
              <div style={styles.userContent}>{msg.content}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'ask' ? 'Ask the engineer...' : 'Instruction for the driver...'}
          rows={2}
          disabled={loading}
        />
        <button
          style={{
            ...styles.sendBtn,
            ...(mode === 'driver' ? styles.sendBtnDriver : {}),
            ...(loading || !input.trim() ? styles.sendBtnDisabled : {}),
          }}
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? '...' : mode === 'ask' ? 'ASK' : 'SEND'}
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
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #21262d',
    background: '#161b22',
    flexShrink: 0,
  },
  title: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#7ee787',
  },
  modeToggle: {
    display: 'flex',
    gap: '4px',
  },
  modeBtn: {
    padding: '3px 8px',
    fontSize: '10px',
    border: '1px solid #30363d',
    borderRadius: '4px',
    background: 'transparent',
    color: '#8b949e',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  modeBtnActive: {
    background: '#238636',
    borderColor: '#238636',
    color: '#fff',
  },
  modeBtnDriverActive: {
    background: '#da3633',
    borderColor: '#da3633',
    color: '#fff',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  emptyState: {
    color: '#484f58',
    fontSize: '12px',
    textAlign: 'center' as const,
    padding: '20px',
    fontStyle: 'italic',
  },
  message: {
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  userMessage: {
    background: '#1c2128',
    borderLeft: '2px solid #58a6ff',
  },
  engineerMessage: {
    background: '#1c2128',
    borderLeft: '2px solid #7ee787',
  },
  messageRole: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#8b949e',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  userContent: {
    color: '#c9d1d9',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    fontSize: '12px',
  },
  mdWrapper: {
    color: '#c9d1d9',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  inputArea: {
    display: 'flex',
    gap: '6px',
    padding: '8px',
    borderTop: '1px solid #21262d',
    background: '#161b22',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '4px',
    color: '#c9d1d9',
    fontSize: '12px',
    fontFamily: 'inherit',
    resize: 'none' as const,
    outline: 'none',
  },
  sendBtn: {
    padding: '6px 14px',
    background: '#238636',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
    alignSelf: 'flex-end',
  },
  sendBtnDriver: {
    background: '#da3633',
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
