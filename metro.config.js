// Metro config: lets the bundled medicine catalogue (src/data/catalog.db) be
// loaded with require() as an asset, so expo-sqlite can copy it on first run.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Treat .db files as assets (not source code).
if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}

module.exports = config;
