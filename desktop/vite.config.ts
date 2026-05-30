import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const breezSdkBundle = path.resolve(
  __dirname,
  "node_modules/@breeztech/breez-sdk-liquid/bundle/breez_sdk_liquid_wasm.js",
);

/** CEF/Vite dev sometimes serves .wasm without application/wasm; streaming init then falls back to fetch. */
function wasmMimeTypePlugin(): Plugin {
  return {
    name: "wasm-mime-type",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0]?.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Same keys as mobile/ext; merged from repo root, mobile/, and desktop/ .env files. */
function loadDesktopEnv(mode: string): Record<string, string> {
  const repoRoot = path.resolve(__dirname, "..");
  const mobileRoot = path.resolve(__dirname, "../mobile");
  const desktopRoot = __dirname;
  return {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, mobileRoot, ""),
    ...loadEnv(mode, desktopRoot, ""),
  };
}

function breezApiKeyPlugin(getKey: () => string | undefined): Plugin {
  return {
    name: "breez-api-key-check",
    buildStart() {
      if (!getKey()) {
        this.warn(
          "[desktop] EXPO_PUBLIC_BREEZ_API_KEY is missing. Liquid (Breez) will not work.\n" +
            "  Add it to desktop/.env or mobile/.env (same as mobile), then restart Vite (bun run hmr / bun run start).",
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadDesktopEnv(mode);
  const breezApiKey =
    process.env.EXPO_PUBLIC_BREEZ_API_KEY ??
    env.EXPO_PUBLIC_BREEZ_API_KEY ??
    "";
  const mcpTunnelUrl =
    process.env.EXPO_PUBLIC_MCP_TUNNEL_URL ??
    env.EXPO_PUBLIC_MCP_TUNNEL_URL ??
    "";
  const sharedRoot = path.resolve(__dirname, "src/mainview/shared-link");

  return {
    // Relative paths so bundled assets load under views://mainview/ in Electrobun
    base: "./",
    envDir: __dirname,
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      wasmMimeTypePlugin(),
      breezApiKeyPlugin(() => breezApiKey),
    ],
    assetsInclude: ["**/*.wasm"],
    root: "src/mainview",
    resolve: {
      preserveSymlinks: true,
      mainFields: ["browser", "module", "jsnext:main", "jsnext", "main"],
      conditions: ["browser", "import", "module", "default"],
      alias: [
        {
          // Bundle target inlines WASM at import (ext webpack asset/inline parity); avoids fetch + MIME issues in CEF.
          find: "@breeztech/breez-sdk-liquid",
          replacement: breezSdkBundle,
        },
        {
          find: "bignumber.js",
          replacement: path.resolve(
            __dirname,
            "node_modules/bignumber.js/bignumber.mjs",
          ),
        },
        {
          find: "ethers",
          replacement: path.resolve(
            __dirname,
            "node_modules/ethers/lib.esm/index.js",
          ),
        },
        {
          find: "@noble/hashes/scrypt",
          replacement: path.resolve(
            __dirname,
            "node_modules/@noble/hashes/scrypt.js",
          ),
        },
        {
          find: "@noble/hashes/sha256",
          replacement: path.resolve(
            __dirname,
            "node_modules/@noble/hashes/sha256.js",
          ),
        },
        {
          find: "@noble/hashes/utils",
          replacement: path.resolve(
            __dirname,
            "node_modules/@noble/hashes/esm/utils.js",
          ),
        },
        {
          find: "@buildonspark/spark-sdk",
          replacement: path.resolve(
            __dirname,
            "node_modules/@buildonspark/spark-sdk/dist/index.browser.js",
          ),
        },
        {
          find: "@noble/hashes/legacy",
          replacement: path.resolve(
            __dirname,
            "src/mainview/shims/noble-hashes-legacy.js",
          ),
        },
        { find: "@shared", replacement: sharedRoot },
        {
          find: "@shared/features/mcp/modules/mcp-activity-log",
          replacement: path.resolve(
            sharedRoot,
            "features/mcp/modules/mcp-activity-log.ts",
          ),
        },
        {
          find: "@shared/features/mcp/modules/tunnel",
          replacement: path.resolve(
            sharedRoot,
            "features/mcp/modules/tunnel.ts",
          ),
        },
        { find: "@", replacement: path.resolve(__dirname, "src/mainview") },
        {
          find: "expo/fetch",
          replacement: path.resolve(
            __dirname,
            "src/mainview/modules/expo-fetch-shim.ts",
          ),
        },
        {
          find: "@arkade-os/sdk/adapters/expo",
          replacement: path.resolve(
            __dirname,
            "node_modules/@arkade-os/sdk/dist/adapters/expo.js",
          ),
        },
        {
          find: "events",
          replacement: path.resolve(__dirname, "node_modules/events/events.js"),
        },
        {
          find: "assert",
          replacement: path.resolve(
            __dirname,
            "node_modules/assert/build/assert.js",
          ),
        },
        {
          find: "crypto",
          replacement: path.resolve(
            __dirname,
            "node_modules/crypto-browserify/index.js",
          ),
        },
        {
          find: "stream",
          replacement: path.resolve(
            __dirname,
            "node_modules/stream-browserify/index.js",
          ),
        },
        {
          find: "buffer",
          replacement: path.resolve(__dirname, "node_modules/buffer/index.js"),
        },
        {
          find: "process",
          replacement: path.resolve(
            __dirname,
            "node_modules/process/browser.js",
          ),
        },
        {
          find: "path",
          replacement: path.resolve(
            __dirname,
            "node_modules/path-browserify/index.js",
          ),
        },
        {
          find: "vm",
          replacement: path.resolve(__dirname, "src/mainview/shims/vm-stub.js"),
        },
        {
          find: "randomfill",
          replacement: path.resolve(
            __dirname,
            "src/mainview/shims/randomfill.js",
          ),
        },
        {
          find: "randomfill/browser.js",
          replacement: path.resolve(
            __dirname,
            "src/mainview/shims/randomfill.js",
          ),
        },
        {
          find: "zlib",
          replacement: path.resolve(
            __dirname,
            "node_modules/browserify-zlib/lib/index.js",
          ),
        },
        {
          find: "http",
          replacement: path.resolve(
            __dirname,
            "node_modules/stream-http/index.js",
          ),
        },
        {
          find: "https",
          replacement: path.resolve(
            __dirname,
            "node_modules/stream-http/index.js",
          ),
        },
        {
          find: "url",
          replacement: path.resolve(__dirname, "node_modules/url/url.js"),
        },
        {
          find: "timers",
          replacement: path.resolve(
            __dirname,
            "node_modules/timers-browserify/main.js",
          ),
        },
        {
          find: "util",
          replacement: path.resolve(__dirname, "node_modules/util/util.js"),
        },
        {
          find: "unenv/node/buffer",
          replacement: path.resolve(__dirname, "node_modules/buffer/index.js"),
        },
        {
          find: "@noble/hashes/webcrypto.js",
          replacement: path.resolve(
            __dirname,
            "node_modules/@noble/hashes/crypto.js",
          ),
        },
        {
          find: /^@noble\/hashes\/((?!webcrypto)[^/]+\.js)$/,
          replacement:
            path.resolve(__dirname, "node_modules/@noble/hashes") + "/$1",
        },
      ],
    },
    define: {
      "process.env.EXPO_PUBLIC_BREEZ_API_KEY": JSON.stringify(breezApiKey),
      "process.env.EXPO_PUBLIC_MCP_TUNNEL_URL": JSON.stringify(mcpTunnelUrl),
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.browser": JSON.stringify(true),
      __DEV__: JSON.stringify(mode !== "production"),
      global: "globalThis",
    },
    optimizeDeps: {
      // Pre-bundling breaks `new URL('*.wasm', import.meta.url)` in the web entry.
      exclude: ["@breeztech/breez-sdk-liquid"],
      include: [
        "buffer",
        "process",
        "events",
        "bignumber.js",
        "bitcoinjs-lib",
        "assert",
        "ethers",
        "swr",
        "bolt11",
        "bip39",
        "bip32",
        "bs58check",
        "zod",
        "@modelcontextprotocol/sdk/server/mcp.js",
        "@modelcontextprotocol/sdk/types.js",
      ],
      esbuildOptions: {
        target: "esnext",
      },
    },
    build: {
      outDir: "../../dist",
      emptyOutDir: true,
      target: "esnext",
      assetsInlineLimit: 0,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, ".."), sharedRoot],
      },
    },
  };
});
