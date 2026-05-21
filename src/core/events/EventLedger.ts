import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { PitwallEvent } from './types';

export class EventLedger {
  private db: Database.Database;
  private listeners: Array<(event: PitwallEvent) => void> = [];

  constructor(sessionDir: string) {
    fs.mkdirSync(sessionDir, { recursive: true });
    const dbPath = path.join(sessionDir, 'events.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    `);
  }

  append(event: Omit<PitwallEvent, 'id'> & { id?: string }): PitwallEvent {
    const fullEvent = {
      ...event,
      id: event.id || uuid(),
    } as PitwallEvent;

    const stmt = this.db.prepare(
      'INSERT INTO events (id, session_id, ts, type, payload_json) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(
      fullEvent.id,
      fullEvent.sessionId,
      fullEvent.timestamp,
      fullEvent.type,
      JSON.stringify(fullEvent)
    );

    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // don't let listener errors break the ledger
      }
    }

    return fullEvent;
  }

  query(sessionId: string, opts?: {
    type?: string;
    after?: string;
    limit?: number;
  }): PitwallEvent[] {
    let sql = 'SELECT payload_json FROM events WHERE session_id = ?';
    const params: unknown[] = [sessionId];

    if (opts?.type) {
      sql += ' AND type = ?';
      params.push(opts.type);
    }
    if (opts?.after) {
      sql += ' AND ts > ?';
      params.push(opts.after);
    }
    sql += ' ORDER BY ts ASC';
    if (opts?.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{ payload_json: string }>;
    return rows.map(r => JSON.parse(r.payload_json) as PitwallEvent);
  }

  getRecent(sessionId: string, limit: number = 50): PitwallEvent[] {
    const rows = this.db.prepare(
      'SELECT payload_json FROM events WHERE session_id = ? ORDER BY ts DESC LIMIT ?'
    ).all(sessionId, limit) as Array<{ payload_json: string }>;
    return rows.map(r => JSON.parse(r.payload_json) as PitwallEvent).reverse();
  }

  onEvent(listener: (event: PitwallEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  close(): void {
    this.db.close();
  }
}
