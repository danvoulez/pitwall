declare global {
  interface Window {
    pitwall?: {
      getServerPort: () => Promise<number>;
    };
  }
}

export {};
