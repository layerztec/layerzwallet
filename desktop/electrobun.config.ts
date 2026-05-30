import type { ElectrobunConfig } from "electrobun";

import { bunBuildPluginSharedDeps } from "./src/bun/bun-build-plugin-shared-deps";

export default {
  app: {
    name: "layerzwallet-desktop",
    identifier: "com.layerzwallet.desktop",
    version: "0.0.1",
  },
  build: {
    bun: {
      plugins: [bunBuildPluginSharedDeps],
    },
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      // WebKitGTK is weak for WASM-heavy wallet UI; CEF is recommended on Linux.
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
