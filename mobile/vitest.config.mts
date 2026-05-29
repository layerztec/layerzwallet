import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    setupFiles: [
      '../shared/tests/setup-vi.js',
      '../ext/src/modules/spark-adapter.ts',
      '../ext/src/modules/breeze-adapter.ts',
      '../ext/src/modules/error-handler.ts',
    ],
    testTimeout: 120_000,
    dangerouslyIgnoreUnhandledErrors: true, // breez test throws unhandled errors
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '../shared/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    alias: (() => {
      // Create aliases for all modules in node_modules
      const nodeModulesPath = resolve(__dirname, 'node_modules');
      const modules = fs.readdirSync(nodeModulesPath)
        .filter(dir => !dir.startsWith('.') && fs.statSync(resolve(nodeModulesPath, dir)).isDirectory());
      
      const ret = modules.reduce((aliases, moduleName) => {
        aliases[moduleName] = resolve(nodeModulesPath, moduleName);
        return aliases;
      }, {
        '@shared': resolve(__dirname, '../shared'), // Add @shared alias
        '@arkade-os/sdk/adapters/expo': require.resolve('@arkade-os/sdk/adapters/expo'),
      });

      // console.log(ret);

      return ret;
    })(),
  },
});
