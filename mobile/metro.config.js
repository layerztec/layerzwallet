const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withTamagui } = require('@tamagui/metro-plugin');

const ALIASES = {
  // we are not actually using this package in mobile yet, so we can just alias it to anything
  '@vulpemventures/secp256k1-zkp': 'timers-browserify',
};

module.exports = (async () => {
  const defaultConfig = getDefaultConfig(__dirname);
  defaultConfig.resolver.extraNodeModules = {
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    url: require.resolve('url/'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    timers: require.resolve('timers-browserify'),
  };

  // after adding "shared" stupid metro forgets to look into own `node_modules`, so we nee to help it.
  // @see https://stackoverflow.com/questions/69257460/react-native-monorepo-unable-to-resolve-module-babel-runtime-helpers-interopr
  defaultConfig.resolver.nodeModulesPaths = [path.resolve(path.join(__dirname, './node_modules'))];

  defaultConfig.watchFolders = [path.resolve(path.join(__dirname, '../shared'))];

  // this is needed to make ALIASES work for @vulpemventures/secp256k1-zkp package
  // @see https://docs.expo.dev/guides/customizing-metro/#aliases
  defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    return context.resolveRequest(context, ALIASES[moduleName] ?? moduleName, platform);
  };

  // Apply Tamagui configuration
  const tamaguiConfig = withTamagui(defaultConfig, {
    components: ['tamagui'],
    config: './tamagui.config.ts',
    disableExtractFoundComponents: true, // For better performance in development
    ignoreBundleWarnings: ['true'], // Silence Warning 001
  });

  return tamaguiConfig;
})();
