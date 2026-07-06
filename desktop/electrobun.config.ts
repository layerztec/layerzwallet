import type { ElectrobunConfig } from 'electrobun';

import { bunBuildPluginSharedDeps } from './src/bun/bun-build-plugin-shared-deps';

export default {
  app: {
    name: 'layerzwallet',
    identifier: 'com.layerzwallet.desktop',
    version: '1.6.0',
    description: 'Layerz Wallet',
  },
  scripts: {
    postBuild: 'scripts/setup-linux-icons.ts',
  },
  build: {
    bun: {
      plugins: [bunBuildPluginSharedDeps],
    },
    // Vite builds to dist/, we copy from there
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ['dist/**'],
    mac: {
      bundleCEF: false,
      // Same Icon Composer asset as mobile iOS (see mobile/app.json).
      icons: '../mobile/assets/appicon.icon',
      // Signing needs ELECTROBUN_DEVELOPER_ID (+ cert in keychain), notarization needs
      // ELECTROBUN_APPLEAPIKEYPATH/ELECTROBUN_APPLEAPIKEY/ELECTROBUN_APPLEAPIISSUER.
      // Gated on env so local/unconfigured builds stay unsigned instead of failing.
      // Wired up in .github/workflows/build.yml; see https://framework.blackboard.sh/electrobun/guides/code-signing/
      codesign: !!process.env.ELECTROBUN_DEVELOPER_ID,
      notarize: !!process.env.ELECTROBUN_APPLEAPIKEYPATH,
    },
    linux: {
      // WebKitGTK is weak for WASM-heavy wallet UI; CEF is recommended on Linux.
      bundleCEF: true,
      defaultRenderer: 'cef',
      icon: '../mobile/assets/images/android_512x512.png',
    },
    win: {
      bundleCEF: false,
      icon: '../mobile/assets/images/favicon.ico',
    },
  },
} satisfies ElectrobunConfig;
