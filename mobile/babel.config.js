module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for tamagui
      [
        '@babel/plugin-transform-react-jsx',
        {
          runtime: 'automatic',
        },
      ],
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true, // Useful for debugging
          disableExtraction: process.env.NODE_ENV === 'development', // Better for development performance
        },
      ],
      // Support optional chaining and nullish coalescing
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-proposal-nullish-coalescing-operator',
      // optional, only if you want to use reanimated
      'react-native-reanimated/plugin',
    ],
  };
};
