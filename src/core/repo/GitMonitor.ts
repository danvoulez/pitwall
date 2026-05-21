import simpleGit, { SimpleGit, DiffResultTextFile } from 'simple-git';
import { v4 as uuid } from 'uuid';
import { GitDiffSnapshot } from '../events/types';

export class GitMonitor {
  private git: SimpleGit;
  private sessionId: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastDiffHash: string = '';
  private onSnapshot: ((snapshot: GitDiffSnapshot) => void) | null = null;

  constructor(sessionId: string, repoPath: string) {
    this.sessionId = sessionId;
    this.git = simpleGit(repoPath);
  }

  async getStatus(): Promise<string> {
    const status = await this.git.status();
    const lines: string[] = [];
    for (const f of status.modified) lines.push(`M  ${f}`);
    for (const f of status.created) lines.push(`A  ${f}`);
    for (const f of status.deleted) lines.push(`D  ${f}`);
    for (const f of status.not_added) lines.push(`?? ${f}`);
    for (const f of status.renamed) lines.push(`R  ${f.from} -> ${f.to}`);
    return lines.join('\n');
  }

  async getDiffSnapshot(): Promise<GitDiffSnapshot> {
    const diff = await this.git.diffSummary();
    const files = diff.files.map((f) => {
      const textFile = f as DiffResultTextFile;
      return {
        path: f.file,
        status: this.inferStatus(f),
        additions: textFile.insertions,
        deletions: textFile.deletions,
      };
    });

    return {
      type: 'git.diff.snapshot',
      id: uuid(),
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      files,
    };
  }

  async getDiffStat(): Promise<string> {
    try {
      const result = await this.git.diff(['--stat']);
      return result;
    } catch {
      return '';
    }
  }

  async getDiffPreview(maxLength: number = 5000): Promise<string> {
    try {
      const result = await this.git.diff();
      if (result.length > maxLength) {
        return result.substring(0, maxLength) + '\n... (truncated)';
      }
      return result;
    } catch {
      return '';
    }
  }

  startPolling(intervalMs: number = 3000, onSnapshot: (snapshot: GitDiffSnapshot) => void): void {
    this.onSnapshot = onSnapshot;
    this.pollInterval = setInterval(async () => {
      try {
        const snapshot = await this.getDiffSnapshot();
        const hash = JSON.stringify(snapshot.files);
        if (hash !== this.lastDiffHash) {
          this.lastDiffHash = hash;
          this.onSnapshot?.(snapshot);
        }
      } catch {
        // git may not be available or repo not initialized
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private inferStatus(f: { file: string }): 'added' | 'modified' | 'deleted' | 'renamed' {
    const file = f as DiffResultTextFile;
    if (file.insertions > 0 && file.deletions === 0) return 'added';
    if (file.insertions === 0 && file.deletions > 0) return 'deleted';
    return 'modified';
  }
}
