// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .mjs files which are used by Firebase v9+
config.resolver.sourceExts.push('mjs');

module.exports = config;
