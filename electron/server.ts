import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { SessionManager } from '../src/core/session/SessionManager';
import { LLMAdapter } from '../src/core/engineer/RaceEngineer';
import { PitwallEvent } from '../src/core/events/types';

const sessions = new Map<string, SessionManager>();

// Stub LLM adapter — users configure their own key
class StubLLMAdapter implements LLMAdapter {
  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const lastUser = messages.filter(m => m.role === 'user').pop();
    const systemContext = messages.find(m => m.role === 'system' && m.content.includes('MISSION'));

    if (!systemContext) {
      return 'Race Engineer standing by. No mission context available yet.';
    }

    // Parse mission context for smart stub responses
    const context = systemContext.content;
    const changedMatch = context.match(/CHANGED FILES: (.+)/);
    const testMatch = context.match(/TEST RESULTS: (.+)/);
    const claimsMatch = context.match(/CLAIMS:\n([\s\S]*?)(?:\n\n|RISKS)/);
    const statusMatch = context.match(/STATUS: (\w+)/);

    const changedFiles = changedMatch?.[1] || 'none';
    const testResults = testMatch?.[1] || 'none';
    const claims = claimsMatch?.[1] || 'none';
    const status = statusMatch?.[1] || 'unknown';

    if (lastUser?.content.includes('Translate it into a clear')) {
      const instruction = lastUser.content.match(/"(.+)"/)?.[1] || lastUser.content;
      return `---\nOperator instruction:\n\n${instruction}\n\nFocus on this specific task. Report results before proceeding to anything else.\n---`;
    }

    return `📡 Race Engineer report:

**Status**: ${status}
**Changed files**: ${changedFiles}
**Tests**: ${testResults}
**Claims**: ${claims}

${changedFiles !== 'none' && testResults === 'none'
  ? '⚠️ Files modified but no test evidence yet. Recommend running targeted tests before claiming completion.'
  : testResults.includes('failed')
    ? '🔴 Tests failing. Driver should focus on fixing the failing tests before proceeding.'
    : testResults.includes('passed')
      ? '✅ Evidence captured via passing tests. Review diff before committing.'
      : 'Observing. No significant activity detected yet.'}

_Configure LLM API key in Settings for full Race Engineer capabilities._`;
  }
}

export async function startServer(): Promise<void> {
  const app_server = express();
  app_server.use(express.json());

  const server = http.createServer(app_server);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // WebSocket for real-time events
  const wsClients = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId) {
      if (!wsClients.has(sessionId)) {
        wsClients.set(sessionId, new Set());
      }
      wsClients.get(sessionId)!.add(ws);

      ws.on('close', () => {
        wsClients.get(sessionId)?.delete(ws);
      });

      // Handle terminal input from WebSocket
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const session = sessions.get(sessionId);
          if (!session) return;

          if (msg.type === 'terminal.input') {
            session.writeToTerminal(msg.data, msg.source || 'human');
          } else if (msg.type === 'terminal.resize') {
            session.resizeTerminal(msg.cols, msg.rows);
          }
        } catch {
          // ignore malformed messages
        }
      });
    }
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

    const llm = new StubLLMAdapter();
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
          id: mission.id || require('uuid').v4(),
          title: mission.title,
          intent: mission.intent,
        },
      },
      llm
    );

    sessions.set(session.id, session);

    // Wire events to WebSocket
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

    const { text, source } = req.body;
    session.writeToTerminal(text, source || 'human');
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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

    const timeline = session.getTimeline();
    res.json({ events: timeline });
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

    const snapshot = await session.snapshot();
    res.json(snapshot);
  });

  // POST /sessions/:id/lanes
  app_server.post('/sessions/:id/lanes', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      const observations = await session.updateLanes();
      res.json({ observations });
    } catch (err) {
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

  server.listen(4850, () => {
    console.log('Pitwall server running on port 4850');
  });
}
