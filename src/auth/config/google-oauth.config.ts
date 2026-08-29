import { registerAs } from '@nestjs/config';

export default registerAs('googleOAuth', () => ({
  clientId:
    process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret:
    process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  callbackURL:
    process.env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_OAUTH_CALLBACK_URL,
  iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
}));


