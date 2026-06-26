import Electrobun, { BrowserView, BrowserWindow, GlobalShortcut, Updater, Utils } from 'electrobun/bun';

import { handleMessage } from './background-message-controller';
import { applyLinuxWindowIcon } from './linux-window-icon';
import { configureLocalMcpServer } from './local-mcp-server';
import type { DesktopAppRPC } from '../shared/desktop-messages';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

type NewWindowOpenEvent = {
  data: {
    detail?: string | { url?: string };
  };
};

function linkUrlFromNewWindowOpen(event: NewWindowOpenEvent): string | undefined {
  const detail = event.data.detail;
  return typeof detail === 'string' ? detail : detail?.url;
}

function openHttpLinkInSystemBrowser(url: string | undefined): void {
  if (url?.startsWith('http://') || url?.startsWith('https://')) {
    Utils.openExternal(url);
  }
}

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return 'views://mainview/index.html';
}

// Create the main application window
const url = await getMainViewUrl();

const rpc = BrowserView.defineRPC<DesktopAppRPC>({
  // Bun → renderer MCP calls (`mcpHandleHttp`) can be slow — a `pay_lightning_invoice`
  // may take minutes. Raise the default 1s RPC timeout so they aren't cut off mid-flight.
  maxRequestTime: 190_000,
  handlers: {
    requests: {
      processMessage: (message) => handleMessage(message),
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: 'Layerz Wallet',
  url,
  rpc,
  frame: {
    width: 900,
    height: 960,
    x: 200,
    y: 200,
  },
});

applyLinuxWindowIcon(mainWindow.ptr);

// Bridge the local MCP listener (Bun) to the wallet's MCP handler (renderer). The
// listener itself is started/stopped on demand via MCP_LOCAL_SERVER_START/STOP.
configureLocalMcpServer((req) => mainWindow.webview.rpc!.request.mcpHandleHttp(req));

// Open http(s) links from the webview in the system browser (e.g. Terms of Service).
// BrowserView.on() does not expose new-window-open; use the global emitter with a webview id suffix.
Electrobun.events.on(`new-window-open-${mainWindow.webview.id}`, (event: NewWindowOpenEvent) => {
  openHttpLinkInSystemBrowser(linkUrlFromNewWindowOpen(event));
});

async function registerDevToolsShortcuts(): Promise<void> {
  const channel = await Updater.localInfo.channel();
  if (channel !== 'dev') {
    return;
  }

  const toggleDevTools = () => {
    mainWindow.webview.toggleDevTools();
  };

  for (const accelerator of ['F12', 'CommandOrControl+Shift+I'] as const) {
    if (GlobalShortcut.register(accelerator, toggleDevTools)) {
      console.log(`DevTools: press ${accelerator} to toggle`);
    }
  }
}

void registerDevToolsShortcuts();

mainWindow.activate();

console.log('Layerz Wallet desktop app started!');
