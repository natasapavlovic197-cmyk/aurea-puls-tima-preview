declare const runtime: {
  createEdgeRuntime(options: {
    env: Record<string, string>;
    Pool: new (...args: any[]) => unknown;
    fetchImpl?: typeof fetch;
  }): {
    handle(req: Request, route: string): Promise<Response>;
    close(): Promise<unknown>;
  };
};
export = runtime;
