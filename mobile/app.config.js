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
  if (VARIANT === 'devclient') {
    return {
      ...config,
      name: 'Layerz Dev',
      ios: {
        ...config.ios,
        bundleIdentifier: 'com.layerzwallet.mobile.devclient',
      },
    };
  }

  return config;
};
