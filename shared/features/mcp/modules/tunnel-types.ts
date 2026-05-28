/**
 * Tunnel wire types — kept in their own file so the cross-process parity test
 * (`mcp-websocket-tunnel/server.ts` ↔ here) can read them without dragging
 * in the platform-dependent tunnel client. These shapes are intentionally
 * duplicated on the server side; keep both in sync.
 */

export type TunnelHttpRequest = {
  type: 'http_request';
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyBase64: string;
};

export type TunnelHttpResponse = {
  type: 'http_response';
  requestId: string;
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

export type RequestHandler = (req: TunnelHttpRequest) => Promise<TunnelHttpResponse>;
