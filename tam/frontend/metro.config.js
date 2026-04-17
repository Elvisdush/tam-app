const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Dependencies are installed at repo root; Metro must watch and resolve from parent `node_modules`
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Use @teovilla/react-native-web-maps for web so react-native-maps works on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return context.resolveRequest(context, '@teovilla/react-native-web-maps', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Windows: Metro's watcher can throw ENOENT on optional @expo/ngrok-bin-* packages for other OSes
// (e.g. darwin-x64) when those folders are missing or symlinked. Exclude them from the file map.
if (os.platform() === 'win32') {
  const block = config.resolver.blockList;
  const base = Array.isArray(block) ? block : block != null ? [block] : [];
  config.resolver.blockList = [
    ...base,
    /node_modules[\/\\]@expo[\/\\]ngrok-bin-darwin-arm64[\/\\].*/,
    /node_modules[\/\\]@expo[\/\\]ngrok-bin-darwin-x64[\/\\].*/,
    /node_modules[\/\\]@expo[\/\\]ngrok-bin-freebsd-[^/\\]+[\/\\].*/,
    /node_modules[\/\\]@expo[\/\\]ngrok-bin-linux-[^/\\]+[\/\\].*/,
    /node_modules[\/\\]@expo[\/\\]ngrok-bin-sunos-[^/\\]+[\/\\].*/,
  ];
}

module.exports = config;
