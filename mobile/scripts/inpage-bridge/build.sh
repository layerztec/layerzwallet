#!/bin/bash
set -euo pipefail

rm -rf dist
rm -rf ../../assets/assets/js/inpage-bridge.jstxt
../../node_modules/.bin/webpack --config webpack.config.js
echo "" >> ./dist/bundle.js
echo "true" >> ./dist/bundle.js # react-native-webview requires a trailing true
cp ./dist/bundle.js ../../assets/js/inpage-bridge.jstxt
