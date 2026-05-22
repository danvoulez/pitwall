import { useState, useCallback, useRef, useEffect } from 'react';
import { SessionInfo, SessionState, PitwallEventWS } from '../types';

const API_BASE = 'http://localhost:4850';
const WS_BASE = 'ws://localhost:4850/ws';

export function useSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [events, setEvents] = useState<PitwallEventWS[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const eventListenersRef = useRef<Array<(event: PitwallEventWS) => void>>([]);
  const authTokenRef = useRef<string>('');

  const createSession = useCallback(async (
    repoPath: string,
    driverCommand: string,
    driverArgs: string[],
    missionTitle: string,
    missionIntent: string
  ): Promise<SessionInfo> => {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authTokenRef.current}`,
      },
      body: JSON.stringify({
        repoPath,
        driver: { command: driverCommand, args: driverArgs },
        mission: { title: missionTitle, intent: missionIntent },
      }),
    });
    const data = await res.json();
    const info: SessionInfo = { sessionId: data.sessionId, status: data.status };
    setSession(info);
    return info;
  }, []);

  const loadTimeline = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${sessionId}/timeline`,
        { headers: { 'Authorization': `Bearer ${authTokenRef.current}` } }
      );
      const data = await res.json();
      if (data.events && Array.isArray(data.events)) {
        setEvents(data.events as PitwallEventWS[]);
      }
    } catch {
      // timeline not available yet
    }
  }, []);

  const connectWs = useCallback((sessionId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Load existing timeline events first
    loadTimeline(sessionId);

    const ws = new WebSocket(
      `${WS_BASE}?sessionId=${sessionId}&token=${authTokenRef.current}`
    );
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event: PitwallEventWS = JSON.parse(msg.data);
        setEvents(prev => {
          // Deduplicate by id
          if (prev.some(e => e.id === event.id)) return prev;
          return [...prev.slice(-500), event];
        });
        for (const listener of eventListenersRef.current) {
          listener(event);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (session?.sessionId === sessionId) {
          connectWs(sessionId);
        }
      }, 2000);
    };
  }, [session, loadTimeline]);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authTokenRef.current}`,
  }), []);

  const sendTerminalInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal.input', data }));
    }
  }, []);

  const resizeTerminal = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal.resize', cols, rows }));
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${session.sessionId}/state`,
        { headers: { 'Authorization': `Bearer ${authTokenRef.current}` } }
      );
      const data = await res.json();
      setState(data);
    } catch {
      // ignore
    }
  }, [session]);

  const askEngineer = useCallback(async (message: string): Promise<string> => {
    if (!session) return 'No active session';
    const res = await fetch(`${API_BASE}/sessions/${session.sessionId}/radio/ask`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    return data.response;
  }, [session, authHeaders]);

  const sendToDriver = useCallback(async (instruction: string): Promise<string> => {
    if (!session) return 'No active session';
    const res = await fetch(`${API_BASE}/sessions/${session.sessionId}/radio/send-to-driver`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ instruction }),
    });
    const data = await res.json();
    return data.sent;
  }, [session, authHeaders]);

  const interrupt = useCallback(async () => {
    if (!session) return;
    await fetch(`${API_BASE}/sessions/${session.sessionId}/interrupt`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authTokenRef.current}` },
    });
  }, [session]);

  const updateLanes = useCallback(async () => {
    if (!session) return;
    try {
      await fetch(`${API_BASE}/sessions/${session.sessionId}/lanes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authTokenRef.current}` },
      });
    } catch {
      // ignore
    }
  }, [session]);

  const onEvent = useCallback((listener: (event: PitwallEventWS) => void) => {
    eventListenersRef.current.push(listener);
    return () => {
      eventListenersRef.current = eventListenersRef.current.filter(l => l !== listener);
    };
  }, []);

  const setAuthToken = useCallback((token: string) => {
    authTokenRef.current = token;
  }, []);

  // Poll state every 3 seconds when session is active
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [session, fetchState]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return {
    session,
    state,
    events,
    createSession,
    connectWs,
    sendTerminalInput,
    resizeTerminal,
    fetchState,
    askEngineer,
    sendToDriver,
    interrupt,
    updateLanes,
    onEvent,
    setAuthToken,
  };
}
