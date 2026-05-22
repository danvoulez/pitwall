import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager } from '../src/core/session/SessionManager';
import { PitwallEvent } from '../src/core/events/types';
import { autoDetectLLM, createLLMAdapter, LLMProvider } from '../src/core/llm/index';

const sessions = new Map<string, SessionManager>();

// Per-process auth token — prevents drive-by browser access
const AUTH_TOKEN = crypto.randomBytes(32).toString('hex');

// Auto-detect LLM from environment
const detected = autoDetectLLM();
const llmState = { adapter: detected.adapter, provider: detected.provider };
console.log(`LLM provider: ${llmState.provider}`);

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

const WS_MESSAGE_TYPES = ['terminal.input', 'terminal.resize'] as const;
type WSMessageType = typeof WS_MESSAGE_TYPES[number];

function isValidWSMessage(msg: unknown): msg is { type: WSMessageType; [key: string]: unknown } {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  return (WS_MESSAGE_TYPES as readonly string[]).includes(obj.type);
}

export async function startServer(): Promise<{ port: number; authToken: string }> {
  const app_server = express();
  app_server.use(express.json({ limit: '1mb' }));

  // CORS for local access only
  app_server.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Auth token endpoint — only accessible from Electron preload
  app_server.get('/auth/token', (_req, res) => {
    // In production, this should verify the request comes from Electron
    res.json({ token: AUTH_TOKEN });
  });

  // LLM config endpoint — check/update provider
  app_server.get('/config/llm', authMiddleware, (_req, res) => {
    res.json({ provider: llmState.provider });
  });

  app_server.post('/config/llm', authMiddleware, (req, res) => {
    const { provider, apiKey, model } = req.body;
    if (!provider) {
      res.status(400).json({ error: 'Missing provider' });
      return;
    }
    try {
      llmState.adapter = createLLMAdapter({ provider, apiKey, model });
      llmState.provider = provider;
      res.json({ ok: true, provider });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // Protect all /sessions routes
  app_server.use('/sessions', authMiddleware);

  const server = http.createServer(app_server);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const wsClients = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');
    const token = url.searchParams.get('token');

    // Validate auth token on WebSocket connection
    if (!token || token !== AUTH_TOKEN) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    if (!sessionId) {
      ws.close(4002, 'Missing sessionId');
      return;
    }

    if (!wsClients.has(sessionId)) {
      wsClients.set(sessionId, new Set());
    }
    wsClients.get(sessionId)!.add(ws);

    ws.on('close', () => {
      wsClients.get(sessionId)?.delete(ws);
    });

    ws.on('message', (data) => {
      try {
        const raw = data.toString();
        if (raw.length > 65536) return;

        const msg = JSON.parse(raw);
        if (!isValidWSMessage(msg)) return;

        const session = sessions.get(sessionId);
        if (!session) return;

        if (msg.type === 'terminal.input') {
          if (typeof msg.data !== 'string') return;
          // Do not trust client-provided source — always 'human' from WS
          session.writeToTerminal(msg.data, 'human');
        } else if (msg.type === 'terminal.resize') {
          if (typeof msg.cols !== 'number' || typeof msg.rows !== 'number') return;
          if (msg.cols < 1 || msg.cols > 1000 || msg.rows < 1 || msg.rows > 500) return;
          session.resizeTerminal(msg.cols, msg.rows);
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  function broadcastToSession(sessionId: string, event: PitwallEvent): void {
    const clients = wsClients.get(sessionId);
    if (!clients) return;
    const data = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  // POST /sessions
  app_server.post('/sessions', (req, res) => {
    const { repoPath, driver, mission } = req.body;

    if (!repoPath || !driver || !mission) {
      res.status(400).json({ error: 'Missing repoPath, driver, or mission' });
      return;
    }

    // Use API key from request body if provided, otherwise use auto-detected default
    let llm = llmState.adapter;
    if (driver.llm?.provider && driver.llm?.apiKey) {
      try {
        llm = createLLMAdapter({
          provider: driver.llm.provider as LLMProvider,
          apiKey: driver.llm.apiKey,
          model: driver.llm.model,
        });
      } catch {
        // fall back to default
      }
    }
    const session = new SessionManager(
      {
        repoPath,
        driver: {
          command: driver.command,
          args: driver.args || [],
          cwd: repoPath,
          env: driver.env,
        },
        mission: {
          id: mission.id || uuidv4(),
          title: mission.title,
          intent: mission.intent,
        },
      },
      llm
    );

    sessions.set(session.id, session);

    session.onEvent((event) => {
      broadcastToSession(session.id, event);
    });

    session.start();

    res.json({
      sessionId: session.id,
      status: 'running',
    });
  });

  // POST /sessions/:id/input
  app_server.post('/sessions/:id/input', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { text } = req.body;
    // Source is always 'human' from the API — not client-trusted
    session.writeToTerminal(text, 'human');
    res.json({ ok: true });
  });

  // POST /sessions/:id/radio/ask
  app_server.post('/sessions/:id/radio/ask', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      const { message } = req.body;
      const response = await session.askEngineer(message);
      res.json({ response });
    } catch (_err) {
      res.status(500).json({ error: 'Engineer error' });
    }
  });

  // POST /sessions/:id/radio/send-to-driver
  app_server.post('/sessions/:id/radio/send-to-driver', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      const { instruction } = req.body;
      const formatted = await session.sendToDriver(instruction);
      res.json({ sent: formatted });
    } catch (_err) {
      res.status(500).json({ error: 'Failed to send instruction' });
    }
  });

  // GET /sessions/:id/state
  app_server.get('/sessions/:id/state', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      const state = await session.getFullState();
      res.json(state);
    } catch (_err) {
      res.status(500).json({ error: 'Failed to get state' });
    }
  });

  // GET /sessions/:id/timeline
  app_server.get('/sessions/:id/timeline', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const events = session.getTimeline();
    res.json({ events });
  });

  // POST /sessions/:id/interrupt
  app_server.post('/sessions/:id/interrupt', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    session.interrupt();
    res.json({ ok: true });
  });

  // POST /sessions/:id/snapshot
  app_server.post('/sessions/:id/snapshot', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const snapshotPath = await session.snapshot();
    res.json({ path: snapshotPath });
  });

  // POST /sessions/:id/lanes
  app_server.post('/sessions/:id/lanes', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      await session.updateLanes();
      const state = await session.getFullState();
      res.json({ laneObservations: state.laneObservations });
    } catch (_err) {
      res.status(500).json({ error: 'Failed to update lanes' });
    }
  });

  // DELETE /sessions/:id
  app_server.delete('/sessions/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    session.stop();
    sessions.delete(req.params.id);
    res.json({ ok: true });
  });

  // GET /sessions
  app_server.get('/sessions', (_req, res) => {
    const list = Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      config: session.config,
    }));
    res.json({ sessions: list });
  });

  const PORT = 4850;
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Pitwall server running on http://127.0.0.1:${PORT}`);
    console.log(`Auth token: ${AUTH_TOKEN}`);
  });

  return { port: PORT, authToken: AUTH_TOKEN };
}
