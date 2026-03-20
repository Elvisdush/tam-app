const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Use @teovilla/react-native-web-maps for web so react-native-maps works on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return context.resolveRequest(context, '@teovilla/react-native-web-maps', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
