const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
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

  return defaultConfig;
})();
