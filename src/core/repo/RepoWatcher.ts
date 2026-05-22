import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { FileChangedEvent } from '../events/types';

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/target/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/coverage/**',
  '**/.pitwall/**',
];

export class RepoWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private sessionId: string;
  private repoPath: string;

  constructor(sessionId: string, repoPath: string) {
    super();
    this.sessionId = sessionId;
    this.repoPath = repoPath;
  }

  start(): void {
    this.watcher = watch(this.repoPath, {
      ignored: IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => this.emitChange(filePath, 'created'));
    this.watcher.on('change', (filePath) => this.emitChange(filePath, 'modified'));
    this.watcher.on('unlink', (filePath) => this.emitChange(filePath, 'deleted'));
  }

  private emitChange(filePath: string, change: 'created' | 'modified' | 'deleted'): void {
    const relativePath = path.relative(this.repoPath, filePath);

    const event: FileChangedEvent = {
      type: 'file.changed',
      id: uuid(),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      path: relativePath,
      change,
    };

    this.emit('fileChanged', event);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
