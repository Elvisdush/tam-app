module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Transform import.meta for web: Metro serves a classic script bundle, so raw
          // import.meta would throw "Cannot use 'import.meta' outside a module".
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
