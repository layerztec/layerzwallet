import { Database } from "bun:sqlite";

const TLS_CERT_PATH = Bun.env.TLS_CERT_PATH;
const TLS_KEY_PATH = Bun.env.TLS_KEY_PATH;

type Session = {
  id: string;
  ws: ServerWebSocket | null;
  createdAt: number;
  lastSeenAt: number;
  /** Wall-clock when the WS went away; null while online. Informational. */
  disconnectedAt: number | null;
  /** Scheduled drop of pending requests once the grace period expires. */
  purgeTimer: Timer | null;
  pending: Map<string, PendingRequest>;
};

type PendingRequest = {
  /** Stored so we can re-send over a freshly resumed WebSocket. */
  req: TunnelHttpRequest;
  resolve: (msg: TunnelHttpResponse) => void;
  reject: (err: Error) => void;
  timer: Timer;
  /** For log lines on timeout / flush / errors. */
  mcpSummary: string;
};

// NOTE: TunnelHttpRequest / TunnelHttpResponse are duplicated on the device
// side in mobile/src/modules/tunnel.ts. Keep both definitions in sync.
type TunnelHttpRequest = {
  type: "http_request";
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyBase64: string;
};

type TunnelHttpResponse = {
  type: "http_response";
  requestId: string;
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

type ServerWebSocket = Bun.ServerWebSocket<{
  sessionId: string;
}>;

/** Empty `KEY=` in `.env` is still a string; `Number('')` is 0 — treat blank as unset. */
function numEnv(key: string, fallback: number, min: number): number {
  const s = Bun.env[key]?.trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

const PORT = numEnv("PORT", 4433, 1);
const PUBLIC_BASE_URL =
  Bun.env.PUBLIC_BASE_URL?.trim() || `http://localhost:${PORT}`;
/** Max wait for the phone to answer a tunneled HTTP request (Lightning pay can be slow). */
const REQUEST_TIMEOUT_MS = numEnv("REQUEST_TIMEOUT_MS", 180_000, 1);
const MAX_BODY_BYTES = numEnv("MAX_BODY_BYTES", 10 * 1024 * 1024, 1);
/** How long a disconnected session waits for a resume before its pending requests are dropped. */
const SESSION_GRACE_MS = numEnv("SESSION_GRACE_MS", 60_000, 0);
const DB_PATH = Bun.env.DB_PATH?.trim() || "tunnel.db";
/** Min interval between successive /connect attempts from the same client IP. */
const CONNECT_RATE_LIMIT_MS = numEnv("CONNECT_RATE_LIMIT_MS", 5_000, 1);

const sessions = new Map<string, Session>();

// Sessions persist forever so that the public URL survives device app
// relaunches and server restarts. Only the per-request `pending` queue is
// ephemeral (and is dropped after SESSION_GRACE_MS of disconnection).
const db = new Database(DB_PATH);
db.exec(
  "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL DEFAULT 0)",
);
// Add the column for pre-existing DBs that were created before we tracked it.
// SQLite has no IF NOT EXISTS for ALTER, so detect via PRAGMA and ignore on duplicate.
const cols = db
  .query<{ name: string }, []>("PRAGMA table_info(sessions)")
  .all()
  .map((r) => r.name);
if (!cols.includes("last_seen_at")) {
  db.exec(
    "ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0",
  );
}

const insertSessionStmt = db.prepare(
  "INSERT OR IGNORE INTO sessions (id, created_at, last_seen_at) VALUES (?, ?, ?)",
);
const updateLastSeenStmt = db.prepare(
  "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
);
const allSessionsStmt = db.prepare<
  { id: string; created_at: number; last_seen_at: number },
  []
>("SELECT id, created_at, last_seen_at FROM sessions");

for (const row of allSessionsStmt.all()) {
  sessions.set(row.id, {
    id: row.id,
    ws: null,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at || row.created_at,
    disconnectedAt: null,
    purgeTimer: null,
    pending: new Map(),
  });
}

/** IP → last successful /connect timestamp. Pruned on each pass. */
const recentConnects = new Map<string, number>();

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

function sid(id: string): string {
  return id.slice(0, 8);
}

function randomId(bytes = 24): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(
    "base64url",
  );
}

function publicUrl(sessionId: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/mcp/${sessionId}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

/**
 * `Request#url` is not always absolute. Path-only values (e.g. `/`) and some
 * probe strings make `new URL(req.url)` throw; treat those as unroutable.
 */
function safeRequestUrl(req: Request): URL | null {
  const raw = req.url;
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(raw, "http://127.0.0.1");
    } catch {
      return null;
    }
  }
}

function parseJson(data: string): any | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** GET/HEAD, else JSON-RPC `method` or `params.name` for `tools/call`. */
function mcpLogLabel(httpMethod: string, body: Buffer): string {
  const u = httpMethod.toUpperCase();
  if (u === "GET" || u === "HEAD") return u;
  if (body.length === 0) return httpMethod;

  const p = parseJson(body.toString("utf8"));
  if (!p) return httpMethod;

  const msgs = Array.isArray(p) ? p : [p];
  const out: string[] = [];
  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as { method?: string; params?: { name?: string } };
    if (!m.method) continue;
    out.push(
      m.method === "tools/call" && m.params?.name ? m.params.name : m.method,
    );
  }
  const s = out.join(", ");
  return s.length ? (s.length > 100 ? `${s.slice(0, 97)}...` : s) : httpMethod;
}

/** Update both the in-memory and persisted `last_seen_at` for a session. */
function touchSession(session: Session, now = Date.now()) {
  session.lastSeenAt = now;
  updateLastSeenStmt.run(now, session.id);
}

/**
 * Called when a session's WebSocket closes. Schedules a `pending` drop after
 * the grace period. The session entry itself lives forever (in SQLite) so
 * the public URL survives.
 */
function markOffline(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.disconnectedAt !== null) return;

  session.ws = null;
  session.disconnectedAt = Date.now();
  session.purgeTimer = setTimeout(
    () => dropPending(sessionId),
    SESSION_GRACE_MS,
  );

  log(
    `session ${sid(sessionId)} offline, grace ${SESSION_GRACE_MS}ms (${session.pending.size} pending held)`,
  );
}

/** Reject every queued request on a session that's been offline too long. The session itself stays. */
function dropPending(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.purgeTimer) {
    clearTimeout(session.purgeTimer);
    session.purgeTimer = null;
  }

  const pendingCount = session.pending.size;
  for (const pending of session.pending.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error("DEVICE_OFFLINE_TIMEOUT"));
  }
  session.pending.clear();

  if (pendingCount > 0) {
    log(
      `session ${sid(sessionId)} dropped ${pendingCount} pending after grace`,
    );
  }
}

/** Re-send all queued tunnel requests over the (freshly) connected WebSocket. */
function flushPending(session: Session) {
  if (!session.ws || session.ws.readyState !== WebSocket.OPEN) return;
  for (const pending of session.pending.values()) {
    try {
      session.ws.send(JSON.stringify(pending.req));
    } catch (err) {
      log(
        `!! ${sid(session.id)} flush send failed req=${pending.req.requestId} [${pending.mcpSummary}]: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

async function handleMcpRequest(
  req: Request,
  sessionId: string,
): Promise<Response> {
  const startedAt = Date.now();
  const session = sessions.get(sessionId);

  if (!session) {
    log(`reject ${sid(sessionId)}: unknown session`);
    return json({ error: "DEVICE_OFFLINE" }, 503);
  }

  // Grace already expired and the device hasn't reconnected — fail fast
  // instead of queuing for the full REQUEST_TIMEOUT_MS.
  if (session.disconnectedAt !== null && session.purgeTimer === null) {
    log(`reject ${sid(sessionId)}: device offline past grace`);
    return json({ error: "DEVICE_OFFLINE" }, 503);
  }

  const body = Buffer.from(await req.arrayBuffer());

  if (body.length > MAX_BODY_BYTES) {
    log(
      `reject ${sid(sessionId)}: body too large (${body.length} > ${MAX_BODY_BYTES})`,
    );
    return json({ error: "BODY_TOO_LARGE" }, 413);
  }

  const requestId = randomId(12);
  const parsed = safeRequestUrl(req);
  if (!parsed) {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  const pathAndQuery = parsed.pathname + parsed.search;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const tunnelReq: TunnelHttpRequest = {
    type: "http_request",
    requestId,
    method: req.method,
    path: pathAndQuery,
    headers,
    bodyBase64: body.toString("base64"),
  };

  const mcpSummary = mcpLogLabel(req.method, body);
  const queued = session.disconnectedAt !== null;
  log(
    `-> ${sid(sessionId)} ${req.method} ${pathAndQuery} [${mcpSummary}] (${body.length}b, req=${requestId}${queued ? ", queued" : ""})`,
  );

  const responsePromise = new Promise<TunnelHttpResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(requestId);
      log(
        `!! ${sid(sessionId)} timeout req=${requestId} [${mcpSummary}] after ${Date.now() - startedAt}ms`,
      );
      reject(new Error("DEVICE_TIMEOUT"));
    }, REQUEST_TIMEOUT_MS);

    session.pending.set(requestId, {
      req: tunnelReq,
      resolve,
      reject,
      timer,
      mcpSummary,
    });
  });

  // Send now if connected. If we're in grace, this just sits in `pending`
  // until `flushPending` re-emits it on resume (or REQUEST_TIMEOUT_MS hits).
  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    try {
      session.ws.send(JSON.stringify(tunnelReq));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(
        `!! ${sid(sessionId)} ws.send failed req=${requestId} [${mcpSummary}]: ${msg}, leaving queued for resume`,
      );
    }
  }

  let tunnelRes: TunnelHttpResponse;

  try {
    tunnelRes = await responsePromise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(
      `!! ${sid(sessionId)} req=${requestId} [${mcpSummary}] failed: ${message} (${Date.now() - startedAt}ms)`,
    );
    return json({ error: message }, 504);
  }

  const responseHeaders = new Headers();

  for (const [key, value] of Object.entries(tunnelRes.headers ?? {})) {
    const lower = key.toLowerCase();

    if (
      lower === "content-length" ||
      lower === "transfer-encoding" ||
      lower === "connection"
    ) {
      continue;
    }

    responseHeaders.set(key, value);
  }

  const responseBody = Buffer.from(tunnelRes.bodyBase64, "base64");

  log(
    `<- ${sid(sessionId)} [${mcpSummary}] ${tunnelRes.status ?? 200} (${responseBody.length}b, ${Date.now() - startedAt}ms, req=${requestId})`,
  );

  return new Response(responseBody, {
    status: tunnelRes.status ?? 200,
    headers: responseHeaders,
  });
}

function withMcpCors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "Accept, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  );
  return new Response(res.body, { status: res.status, headers: h });
}

function mcpCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Accept, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const server = Bun.serve<{ sessionId: string }>({
  port: PORT,

  tls:
    TLS_CERT_PATH && TLS_KEY_PATH
      ? {
          cert: Bun.file(TLS_CERT_PATH),
          key: Bun.file(TLS_KEY_PATH),
        }
      : undefined,

  async fetch(req, server) {
    const remote = server.requestIP(req);
    const remoteAddr = remote ? `${remote.address}:${remote.port}` : "?";

    const url = safeRequestUrl(req);
    if (!url) {
      return json({ error: "NOT_FOUND" }, 404);
    }

    if (url.pathname === "/health") {
      return json({ ok: true, sessions: sessions.size });
    }

    if (url.pathname === "/connect") {
      const requested = url.searchParams.get("sessionId");
      const existing = requested ? sessions.get(requested) : undefined;

      // Rate-limit *new* session creation only. Resume reconnects are the
      // happy path on flaky mobile networks and must never be throttled —
      // requiring a known sessionId proves the client is a legitimate
      // returning device, not a DoS source.
      if (!existing) {
        const ip = remote?.address ?? "?";
        const now = Date.now();
        const last = recentConnects.get(ip);
        if (last !== undefined && now - last < CONNECT_RATE_LIMIT_MS) {
          log(
            `rate-limited /connect from ${remoteAddr} (${now - last}ms since last new-session attempt)`,
          );
          return json({ error: "RATE_LIMITED" }, 429);
        }
        recentConnects.set(ip, now);
        // Opportunistic prune so the map can't grow unboundedly.
        if (recentConnects.size > 1024) {
          for (const [k, t] of recentConnects) {
            if (now - t > CONNECT_RATE_LIMIT_MS * 4) recentConnects.delete(k);
          }
        }
      }

      let sessionId: string;

      if (existing) {
        // Resume the same id; the open() handler reattaches.
        sessionId = existing.id;
      } else {
        if (requested) {
          log(
            `resume requested for unknown session ${sid(requested)}, issuing fresh id`,
          );
        }
        sessionId = randomId(24);
      }

      const upgraded = server.upgrade(req, { data: { sessionId } });

      if (!upgraded) {
        log(`upgrade failed from ${remoteAddr}`);
        return json({ error: "WEBSOCKET_UPGRADE_FAILED" }, 400);
      }

      return undefined;
    }

    const match = url.pathname.match(/^\/mcp\/([^/]+)$/);

    if (match) {
      // Agent → tunnel is plain HTTP. Until the phone answers, we send no
      // bytes downstream, so Bun's default HTTP idle cutoff can kill the
      // request (often seen as "fetch failed"). This does NOT affect the
      // device WebSocket — that uses `websocket.idleTimeout` below.
      server.timeout(req, 0);
      if (req.method === "OPTIONS") {
        return mcpCorsPreflightResponse();
      }
      return withMcpCors(await handleMcpRequest(req, match[1]));
    }

    return json({ error: "NOT_FOUND" }, 404);
  },

  websocket: {
    /**
     * Bun default is 120s with no WS traffic. The app sends JSON `ping` every
     * 30s, but OS backgrounding can stall timers. Bun caps `idleTimeout` at
     * 960s (16m) — use the max so we rarely close the device tunnel for idle.
     * The phone client still reconnects on close (`tunnel.ts`).
     */
    idleTimeout: 960,

    open(ws) {
      const sessionId = ws.data.sessionId;
      const now = Date.now();
      const existing = sessions.get(sessionId);

      if (existing) {
        // Resume — same id is already known (in memory or restored from SQLite).
        // If a previous WebSocket is still attached (race), supersede it.
        const oldWs = existing.ws;
        if (oldWs && oldWs !== ws) {
          try {
            oldWs.close(4000, "superseded by resume");
          } catch {}
        }

        if (existing.purgeTimer) {
          clearTimeout(existing.purgeTimer);
          existing.purgeTimer = null;
        }
        existing.ws = ws;
        existing.disconnectedAt = null;
        touchSession(existing, now);

        ws.send(
          JSON.stringify({
            type: "session_resumed",
            sessionId,
            publicUrl: publicUrl(sessionId),
            pendingCount: existing.pending.size,
          }),
        );

        flushPending(existing);

        log(
          `session ${sid(sessionId)} resumed (${existing.pending.size} pending replayed, ${sessions.size} total)`,
        );
        return;
      }

      // Brand new session id — server-minted.
      const session: Session = {
        id: sessionId,
        ws,
        createdAt: now,
        lastSeenAt: now,
        disconnectedAt: null,
        purgeTimer: null,
        pending: new Map(),
      };

      sessions.set(sessionId, session);
      insertSessionStmt.run(sessionId, now, now);

      ws.send(
        JSON.stringify({
          type: "session_created",
          sessionId,
          publicUrl: publicUrl(sessionId),
        }),
      );

      log(`session ${sid(sessionId)} created (${sessions.size} total)`);
    },

    message(ws, raw) {
      const session = sessions.get(ws.data.sessionId);
      if (!session) {
        log(`!! message for unknown session ${sid(ws.data.sessionId)}`);
        return;
      }
      // Ignore messages from a stale WebSocket that's been superseded by a
      // resume — only the currently-attached ws speaks for the session.
      if (session.ws !== ws) return;

      touchSession(session);

      const text =
        typeof raw === "string"
          ? raw
          : Buffer.from(raw as ArrayBuffer).toString("utf8");

      const msg = parseJson(text);
      if (!msg) {
        log(`!! ${sid(session.id)} invalid json (${text.length}b)`);
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      }

      if (msg.type !== "http_response") {
        log(`!! ${sid(session.id)} unknown msg type: ${msg.type}`);
        return;
      }

      const pending = session.pending.get(msg.requestId);
      if (!pending) {
        log(`!! ${sid(session.id)} response for unknown req=${msg.requestId}`);
        return;
      }

      clearTimeout(pending.timer);
      session.pending.delete(msg.requestId);
      pending.resolve(msg);
    },

    close(ws, code, reason) {
      const r = reason ? ` reason="${reason}"` : "";
      log(`ws closed ${sid(ws.data.sessionId)} code=${code}${r}`);

      // If a resume already swapped in a new ws, this close belongs to the
      // old one and shouldn't mark the (now-active) session offline.
      const session = sessions.get(ws.data.sessionId);
      if (!session || session.ws !== ws) return;

      markOffline(ws.data.sessionId);
    },
  },
});

const tls = TLS_CERT_PATH && TLS_KEY_PATH ? "tls" : "plain";
log(
  `server listening on :${server.port} (${tls}) public=${PUBLIC_BASE_URL} db=${DB_PATH} restored=${sessions.size} session(s)`,
);
