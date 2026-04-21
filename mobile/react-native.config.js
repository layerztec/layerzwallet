const isMacCatalystBuild = process.env.EXPO_ENABLE_MAC_CATALYST === '1';

module.exports = {
  dependencies: isMacCatalystBuild
    ? {
        '@breeztech/breez-sdk-liquid-react-native': {
          platforms: {
            ios: null,
          },
        },
        '@buildonspark/spark-sdk': {
          platforms: {
            ios: null,
          },
        },
      }
    : {},
};
