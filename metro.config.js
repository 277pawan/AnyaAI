const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      // Exclude ALL Android + iOS native build output dirs from being watched.
      // These are generated artifacts — Metro has no reason to watch them and
      // they're the primary cause of ENOSPC / "too many file watchers" errors.
      /.*\/android\/build\/.*/,
      /.*\/android\/\.gradle\/.*/,
      /.*\/ios\/build\/.*/,
      /.*\/node_modules\/.*\/android\/build\/.*/,
      /.*\/node_modules\/.*\/ios\/build\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

