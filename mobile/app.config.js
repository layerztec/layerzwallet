const { expo } = require('./app.json');

const profile = process.env.EAS_BUILD_PROFILE || '';
const variant = process.env.APP_VARIANT || (profile.includes('devclient') ? 'devclient' : 'default');

const config = {
  ...expo,
  ios: {
    ...expo.ios,
  },
  android: {
    ...expo.android,
  },
};

if (variant === 'devclient') {
  config.name = 'Dev-client LZW';
  config.ios.bundleIdentifier = 'com.layerzwallet.mobile.devclient';
}

module.exports = { expo: config };