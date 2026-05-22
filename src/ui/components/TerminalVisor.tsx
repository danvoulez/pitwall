import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { PitwallEventWS } from '../types';

interface TerminalVisorProps {
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onEvent: (listener: (event: PitwallEventWS) => void) => () => void;
}

export const TerminalVisor: React.FC<TerminalVisorProps> = ({ onInput, onResize, onEvent }) => {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#76e3ea',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#b3f0ff',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(termRef.current);

    fitAddon.fit();
    onResize(terminal.cols, terminal.rows);

    terminal.onData((data) => {
      onInput(data);
    });

    terminal.onResize(({ cols, rows }) => {
      onResize(cols, rows);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Subscribe to PTY output events
    const unsubscribe = onEvent((event) => {
      if (event.type === 'pty.output' && event.data) {
        terminal.write(event.data);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [onInput, onResize, onEvent]);

  return (
    <div
      ref={termRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px',
        background: '#0d1117',
        borderRadius: '6px',
      }}
    />
  );
};
