const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./uniwind-types.d.ts",
  // Only needed to switch to the Moon or Grass themes at runtime.
  extraThemes: ["moon", "moon-dark", "grass", "grass-dark"],
});
