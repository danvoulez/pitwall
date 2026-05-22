declare module 'node-pty' {
  export interface IPty {
    readonly pid: number;
    readonly cols: number;
    readonly rows: number;
    readonly process: string;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): void;
    onExit(listener: (e: { exitCode: number; signal?: number }) => void): void;
  }

  export interface IWindowsPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    encoding?: string;
    useConpty?: boolean;
    conptyInheritCursor?: boolean;
  }

  export interface IPtyForkOptions extends IWindowsPtyForkOptions {
    uid?: number;
    gid?: number;
  }

  export function spawn(
    file: string,
    args: string[],
    options: IPtyForkOptions
  ): IPty;
}
