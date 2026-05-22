import { Gate, GateName } from './types';
import { PitwallEvent } from '../events/types';

export class GateManager {
  private gates: Map<GateName, Gate> = new Map();
  private hasChangedFiles = false;
  private hasPassingTest = false;
  private hasFailingTest = false;
  private hasMigration = false;
  private hasDependencyChange = false;

  constructor() {
    this.initGates();
  }

  private initGates(): void {
    const defaults: Gate[] = [
      { name: 'commit', status: 'open' },
      { name: 'migration', status: 'open' },
      { name: 'dependency', status: 'open' },
      { name: 'deploy', status: 'locked', reason: 'MVP: deploy gate always locked' },
      { name: 'destructive_command', status: 'open' },
    ];
    for (const gate of defaults) {
      this.gates.set(gate.name, gate);
    }
  }

  processEvent(event: PitwallEvent): void {
    if (event.type === 'file.changed') {
      this.hasChangedFiles = true;
      if (event.path.includes('migration')) {
        this.hasMigration = true;
      }
      if (
        event.path === 'package.json' ||
        event.path === 'package-lock.json' ||
        event.path === 'yarn.lock' ||
        event.path === 'pnpm-lock.yaml' ||
        event.path === 'Cargo.toml' ||
        event.path === 'Cargo.lock' ||
        event.path === 'requirements.txt' ||
        event.path === 'Pipfile.lock' ||
        event.path === 'go.mod' ||
        event.path === 'go.sum'
      ) {
        this.hasDependencyChange = true;
      }
    }

    if (event.type === 'test.detected') {
      if (event.status === 'passed') this.hasPassingTest = true;
      if (event.status === 'failed') this.hasFailingTest = true;
    }

    if (event.type === 'command.detected') {
      const dangerous = [
        'rm -rf', 'drop table', 'drop database',
        'git push --force', 'git reset --hard',
        'sudo rm', 'format', 'fdisk',
      ];
      const cmd = event.command.toLowerCase();
      if (dangerous.some(d => cmd.includes(d))) {
        this.gates.set('destructive_command', {
          name: 'destructive_command',
          status: 'warn',
          reason: `Detected: ${event.command}`,
        });
      }
    }

    this.updateGates();
  }

  private updateGates(): void {
    // Commit gate
    if (this.hasChangedFiles && !this.hasPassingTest) {
      this.gates.set('commit', {
        name: 'commit',
        status: this.hasFailingTest ? 'locked' : 'warn',
        reason: this.hasFailingTest
          ? 'Changed files exist but tests are failing'
          : 'Changed files exist but no passing test detected',
      });
    } else if (this.hasChangedFiles && this.hasPassingTest) {
      this.gates.set('commit', {
        name: 'commit',
        status: 'open',
        reason: 'Tests passing',
      });
    }

    // Migration gate
    if (this.hasMigration) {
      this.gates.set('migration', {
        name: 'migration',
        status: 'warn',
        reason: 'Migration file detected — review carefully',
      });
    }

    // Dependency gate
    if (this.hasDependencyChange) {
      this.gates.set('dependency', {
        name: 'dependency',
        status: 'warn',
        reason: 'Dependency files modified',
      });
    }
  }

  getGates(): Gate[] {
    return Array.from(this.gates.values());
  }
}
