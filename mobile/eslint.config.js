const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'entry.js'],
    languageOptions: {
      globals: {
        node: true, // for the inpage-bridge webpack config
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-named-as-default': 'off',
      'react/no-unescaped-entities': 'off',
      // Subpath + .js imports (e.g. server/mcp.js) resolve via package exports; eslint-plugin-import does not.
      'import/no-unresolved': ['error', { ignore: ['^@modelcontextprotocol/sdk/'] }],
    },
  },
]);
