/**
 * WalletConnect/WebRGB wallet-side service — a singleton observable store
 * (snapshot/subscribe, useSyncExternalStore-compatible) owning the WalletKit
 * client, the WebRGB transport adapter and the approval-prompt primitive.
 *
 * v1 scope: RGB testnet only (chain `rgb:utexo` — what the UTEXO bridge
 * frontend expects), read methods + blindReceive. No network switching: the
 * served wallet is always NETWORK_RGB_TESTNET regardless of the UI's
 * selected network, so there is no reset()/generation dance from the
 * reference implementation — the transport attaches once per process.
 *
 * Mechanics ported from UTEXO's reference wallet (rgb-sdk-rn-sandbox
 * utils/wallet/{connection,service}.ts); see tasks/rgb-test-plan.md for the
 * verification matrix.
 */
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { createWalletConnectWallet, type WalletConnectWallet, type WalletConnectWalletContext, type WalletConnectBackend } from '@utexo/webrgb-walletconnect';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { isRgbSession, parseWalletConnectUri, sessionOrigin, type WcSessionLike } from './wc-protocol';
import { buildBackend, WC_NETWORK, WC_RPC_METHODS, WC_METHODS, resolveAccount } from './wc-provider';

type WalletClient = Awaited<ReturnType<typeof WalletKit.init>>;

export type WcPrompt = {
  title: string;
  origin: string;
  details: string;
  expiresAt: number;
  /** WalletConnect Verify verdict — 'UNKNOWN' renders an explicit unverified warning. */
  verification?: 'VALID' | 'UNKNOWN';
  resolve: (approved: boolean) => void;
};

export type WcSessionInfo = { topic: string; name: string; url: string; network: string };

export type WcState = {
  /** 'idle' until the WalletKit client exists; 'starting' while it boots. */
  status: 'idle' | 'starting' | 'ready' | 'unconfigured';
  sessions: WcSessionInfo[];
  prompt: WcPrompt | null;
  pairing: boolean;
  error: string;
  message: string;
};

const HAD_SESSIONS_KEY = '@layerz/wc-had-sessions';
const STORAGE_PREFIX = '@layerz/wc-v1'; // stable: sessions must survive restarts

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

class WcService {
  private state: WcState = { status: 'idle', sessions: [], prompt: null, pairing: false, error: '', message: '' };
  private listeners = new Set<() => void>();
  private client?: WalletClient;
  private clientPromise?: Promise<WalletClient>;
  private core?: InstanceType<typeof Core>;
  private transport?: WalletConnectWallet;
  private account = '';
  /** One serial queue for everything that may touch the native node. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Set by the UI layer so the service can surface the approval screen. */
  onPromptChange?: (prompt: WcPrompt | null) => void;

  // ── store plumbing ───────────────────────────────────────────────────────
  snapshot = (): WcState => this.state;
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  private set(patch: Partial<WcState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((cb) => cb());
    if ('prompt' in patch) this.onPromptChange?.(this.state.prompt);
  }

  hasProjectId(): boolean {
    const id = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    return !!id && /^[a-fA-F0-9]{32}$/.test(id);
  }

  // ── lifecycle ────────────────────────────────────────────────────────────
  /** Boot WalletKit on app start only when a previous run had sessions. */
  async bootstrapIfHadSessions(): Promise<void> {
    try {
      if ((await LayerzStorage.getItem(HAD_SESSIONS_KEY)) === 'true' && this.hasProjectId()) await this.getClient();
    } catch (e) {
      this.set({ error: messageOf(e) });
    }
  }

  private async getClient(): Promise<WalletClient> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;
    const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    if (!projectId || !/^[a-fA-F0-9]{32}$/.test(projectId)) {
      this.set({ status: 'unconfigured' });
      throw new Error('WalletConnect is not configured (EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID).');
    }
    this.set({ status: 'starting', error: '' });
    this.core ??= new Core({ projectId, customStoragePrefix: STORAGE_PREFIX });
    this.clientPromise = (async () => {
      try {
        // The transport needs our node pubkey before it can match sessions.
        this.account = await resolveAccount();
        const client = await WalletKit.init({
          core: this.core!,
          metadata: {
            name: 'Layerz Wallet',
            description: 'Bitcoin & Layer 2 wallet with RGB assets',
            url: 'https://layerzwallet.com',
            icons: [],
            redirect: { native: 'layerzwallet://WalletConnectSessions' },
          },
        });
        this.client = client;
        this.attach(client);
        client.on('session_delete', () => this.refreshSessions());
        client.core.expirer.on('expirer_expired', () => this.refreshSessions());
        this.set({ status: 'ready' });
        this.refreshSessions();
        return client;
      } catch (e) {
        this.set({ status: this.hasProjectId() ? 'idle' : 'unconfigured', error: messageOf(e) });
        throw e;
      } finally {
        this.clientPromise = undefined;
      }
    })();
    return this.clientPromise;
  }

  private attach(client: WalletClient) {
    if (this.transport) return;
    this.transport = createWalletConnectWallet({
      client,
      network: WC_NETWORK,
      account: this.account.slice(this.account.lastIndexOf(':') + 1),
      methods: [...WC_METHODS],
      approveSession: (proposal) =>
        this.enqueue(() =>
          this.confirm(
            'Connect to website?',
            proposal.origin,
            `${proposal.name}\nNetwork: ${proposal.network}\nPermissions: ${proposal.methods.join(', ')}\nCreating receive invoices will ask for confirmation.`,
            Date.now() + 240_000,
            proposal.signal,
            proposal.verification
          )
        ),
      getProvider: (context: WalletConnectWalletContext): Promise<WalletConnectBackend> =>
        buildBackend(context, {
          enqueue: (a) => this.enqueue(a),
          confirm: (title, origin, details, expiresAt, signal) => this.confirm(title, origin, details, expiresAt, signal),
        }),
      onSessionConnected: (session) => {
        this.refreshSessions();
        void LayerzStorage.setItem(HAD_SESSIONS_KEY, 'true');
        try {
          this.set({ message: `Connected to ${sessionOrigin(session.peer.metadata.url)}` });
        } catch {
          this.set({ message: 'Connected' });
        }
      },
      onError: (error) => this.set({ error: messageOf(error) }),
    });
  }

  // ── public API ───────────────────────────────────────────────────────────
  async pair(input: string): Promise<void> {
    const uri = parseWalletConnectUri(input);
    this.set({ pairing: true, error: '', message: 'Waiting for the website connection request…' });
    try {
      await this.getClient();
      await this.transport!.pair(uri);
      this.set({ message: '' });
    } catch (e) {
      this.set({ error: messageOf(e), message: '' });
      throw e;
    } finally {
      this.set({ pairing: false });
    }
  }

  async disconnect(topic: string): Promise<void> {
    try {
      await this.transport?.disconnect(topic);
    } catch (e) {
      this.set({ error: messageOf(e) });
    } finally {
      this.refreshSessions();
    }
  }

  refreshSessions(): void {
    if (!this.client) return;
    const all = Object.values(this.client.getActiveSessions() ?? {}) as unknown as WcSessionLike[];
    const webrgb = all.filter((s) => s.sessionProperties?.webrgb === 'webrgb:1');
    const sessions = webrgb.filter((s) => isRgbSession(s, this.account, WC_RPC_METHODS)).map((s) => ({ topic: s.topic, name: s.peer.metadata.name, url: s.peer.metadata.url, network: WC_NETWORK }));
    // WebRGB sessions that no longer match (seed changed, older app with a
    // wider surface) are zombies: invisible here but alive for the dApp.
    // Disconnect them instead of silently hiding them.
    for (const z of webrgb.filter((s) => !isRgbSession(s, this.account, WC_RPC_METHODS))) {
      void this.transport?.disconnect(z.topic).catch(() => {});
    }
    this.set({ sessions });
    void LayerzStorage.setItem(HAD_SESSIONS_KEY, sessions.length ? 'true' : 'false');
  }

  /**
   * Tear down everything bound to the current wallet identity. MUST be
   * called before clearing or replacing the seed: the transport and
   * `account` are bound to the old wallet, and a surviving session would
   * let a dApp approved under wallet A read wallet B after an in-process
   * re-import.
   */
  async reset(): Promise<void> {
    try {
      for (const s of this.state.sessions) await this.transport?.disconnect(s.topic).catch(() => {});
      this.transport?.dispose();
    } catch (e) {
      this.set({ error: messageOf(e) });
    }
    this.transport = undefined;
    this.client = undefined;
    this.clientPromise = undefined;
    this.core = undefined;
    this.account = '';
    this.state.prompt?.resolve(false);
    this.set({ status: 'idle', sessions: [], prompt: null, pairing: false, error: '', message: '' });
    await LayerzStorage.setItem(HAD_SESSIONS_KEY, 'false');
  }

  /** Called by the pairing screen so "open screen" boots the client lazily. */
  async ensureStarted(): Promise<void> {
    if (!this.hasProjectId()) {
      this.set({ status: 'unconfigured' });
      return;
    }
    await this.getClient().catch(() => {});
  }

  // ── primitives ───────────────────────────────────────────────────────────
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(action, action);
    this.queue = next.catch(() => {});
    return next;
  }

  /**
   * One approval prompt at a time; auto-rejects on expiry or an aborted
   * request. The resolution re-checks expiry — a stale Approve tap after the
   * dApp gave up must not grant anything.
   */
  confirm(title: string, origin: string, details: string, expiresAt: number, signal?: AbortSignal, verification?: 'VALID' | 'UNKNOWN'): Promise<boolean> {
    // An already-dead request must not park a ghost prompt in front of the
    // serial queue (abort listeners added to an aborted signal never fire).
    if (signal?.aborted || expiresAt <= Date.now()) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (approved: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.set({ prompt: null });
        resolve(approved && Date.now() < expiresAt);
      };
      const onAbort = () => finish(false);
      const timer = setTimeout(() => finish(false), Math.max(0, expiresAt - Date.now()));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        finish(false);
        return;
      }
      this.set({ prompt: { title, origin, details, expiresAt, verification, resolve: finish } });
    });
  }
}

export const wcService = new WcService();
