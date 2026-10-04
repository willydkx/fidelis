const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads its SQLite engine as a .wasm asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
