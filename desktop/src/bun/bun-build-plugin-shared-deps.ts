import path from "path";
import { fileURLToPath } from "url";
import type { BunPlugin } from "bun";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** Resolves browser-only deps imported by shared/modules/encryption.ts when bundling the Bun main process. */
export const bunBuildPluginSharedDeps: BunPlugin = {
  name: "layerz-desktop-shared-deps",
  setup(build) {
    build.onResolve({ filter: /^@noble\/hashes\/scrypt$/ }, () => ({
      path: path.join(desktopRoot, "node_modules/@noble/hashes/scrypt.js"),
    }));
    build.onResolve({ filter: /^browserify-cipher$/ }, () => ({
      path: path.join(desktopRoot, "node_modules/browserify-cipher/index.js"),
    }));
  },
};
