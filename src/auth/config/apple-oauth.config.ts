import { registerAs } from '@nestjs/config';

export default registerAs('appleOAuth', () => ({
  clientID: process.env.APPLE_CLIENT_ID,
  teamID: process.env.APPLE_TEAM_ID,
  keyID: process.env.APPLE_KEY_ID,
  privateKey: process.env.APPLE_PRIVATE_KEY,
  privateKeyLocation:
    process.env.APPLE_PRIVATE_KEY_LOCATION ||
    process.env.APPLE_PRIVATE_KEY_PATH,
  callbackURL:
    process.env.APPLE_CALLBACK_URL ||
    'http://localhost:5000/api/v1/auth/apple/callback',
  bundleId: process.env.APPLE_BUNDLE_ID,
}));
