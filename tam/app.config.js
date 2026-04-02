/**
 * Loads `.env` from this app folder before Expo reads config (helps on some Windows setups).
 * EXPO_PUBLIC_* vars are still inlined by Metro — restart with `npx expo start -c` after changing .env.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = require('./app.json');
