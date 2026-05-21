# Pitwall 🏎️

**Mission Control for AI Coding Agents**

> See what your AI coding agent is doing, talk to a supervisor, and stop accepting "done" without evidence.

Pitwall is a desktop cockpit that wraps around Claude Code, Codex, or any terminal-based AI coding agent. It provides real-time observability, a Race Engineer supervisor, evidence-based claim tracking, and session replay.

## What It Does

- **Terminal Visor**: Runs Claude Code/Codex inside an embedded terminal (xterm.js + node-pty)
- **Event Ledger**: Every terminal output, file change, git diff, command, and test result is logged to SQLite
- **Race Radio**: Chat with a Race Engineer LLM that understands the full session state
- **Claims & Evidence**: Detects when agents claim "done" and tracks whether there's actual evidence (tests passed, etc.)
- **Gates**: Visual indicators for commit readiness, dangerous commands, dependency changes
- **Shadow Lanes**: Derived observers (Scout, Reviewer, Test Monitor, Risk Monitor) that analyze the session
- **Timeline**: Replayable event timeline of the entire session

## Architecture

```
┌─────────────────────────────────────────────┐
│ Frontend (React + xterm.js)                 │
│ - Terminal Visor                            │
│ - Race Radio                                │
│ - Mission Panel                             │
│ - Timeline                                  │
│ - Diff Panel                                │
│ - Fleet Lanes                               │
└──────────────────────┬──────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼──────────────────────┐
│ Local Backend (Express + node-pty)           │
│ - PTY Broker                                │
│ - Event Ledger (SQLite)                     │
│ - Repo Watcher (chokidar)                   │
│ - Git Diff Monitor (simple-git)             │
│ - Command/Test Detector                     │
│ - Race Engineer (LLM adapter)               │
│ - Shadow Lanes                              │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Driver Session                              │
│ - Claude Code CLI / Codex CLI / any shell   │
│ - Running inside pseudo-terminal            │
└─────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (Vite + Electron)
npm run dev

# Or just the web frontend (without Electron)
npm run dev:renderer
```

## Stack

- **Electron** — Desktop shell
- **React** — UI framework
- **xterm.js** — Terminal emulator
- **node-pty** — Pseudo-terminal for running agents
- **chokidar** — File system watcher
- **simple-git** — Git operations
- **better-sqlite3** — Event ledger persistence
- **Express + WebSocket** — Local API server

## API

### Create Session
```
POST /sessions
{
  "repoPath": "/path/to/repo",
  "driver": { "command": "claude", "args": [] },
  "mission": { "title": "Fix bug", "intent": "Find and fix..." }
}
```

### Ask Race Engineer
```
POST /sessions/:id/radio/ask
{ "message": "What is the driver doing?" }
```

### Send Instruction to Driver
```
POST /sessions/:id/radio/send-to-driver
{ "instruction": "Run only the refresh token test" }
```

### Get Session State
```
GET /sessions/:id/state
```

### Interrupt Driver
```
POST /sessions/:id/interrupt
```

## Philosophy

The MVP doesn't try to replace Claude Code or Codex. It's the **cockpit layer** above them.

- **Observe** terminal output, file changes, git diffs, test results
- **Converse** with a Race Engineer that understands the session state
- **Verify** claims with evidence — "done" without a passing test stays `unverified`
- **Intervene** by sending instructions or interrupting the agent

The "fleet" (Scout, Reviewer, Test Monitor, Risk Monitor) is derived from observers analyzing the same event log — not separate autonomous agents.

## License

MIT
