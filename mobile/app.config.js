// Dynamic Expo config. The static values still live in app.json; this file
// only mutates them when we want to build a separate "variant" of the app
// (currently: a TestFlight-distributable Expo Dev Client with its own
// bundle id / app store record).
//
// Switch variants with the APP_VARIANT env var. EAS sets it per build profile
// (see eas.json); locally you can run e.g.:
//   APP_VARIANT=devclient npx expo prebuild

const VARIANT = process.env.APP_VARIANT;

module.exports = ({ config }) => {
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  const mergedPlugins = plugins.includes('expo-status-bar') ? plugins : [...plugins, 'expo-status-bar'];

  if (VARIANT === 'devclient') {
    return {
      ...config,
      plugins: mergedPlugins,
      name: 'Layerz Dev',
      ios: {
        ...config.ios,
        bundleIdentifier: 'com.layerzwallet.mobile.devclient',
      },
    };
  }

  return {
    ...config,
    plugins: mergedPlugins,
  };
};
