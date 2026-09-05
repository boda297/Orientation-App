import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-apple';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import appleOauthConfig from '../config/apple-oauth.config';
import { AuthService } from '../auth.service';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    @Inject(appleOauthConfig.KEY)
    private appleConfig: ConfigType<typeof appleOauthConfig>,
    private authService: AuthService,
  ) {
    const privateKeyString = appleConfig.privateKey
      ? appleConfig.privateKey.includes('-----BEGIN PRIVATE KEY-----')
        ? appleConfig.privateKey
        : `-----BEGIN PRIVATE KEY-----\n${appleConfig.privateKey.trim()}\n-----END PRIVATE KEY-----`
      : undefined;

    super({
      clientID: appleConfig.clientID || 'placeholder-apple-client-id',
      teamID: appleConfig.teamID || 'placeholder-team-id',
      keyID: appleConfig.keyID || 'placeholder-key-id',
      ...(privateKeyString
        ? { privateKeyString }
        : {
            privateKeyLocation:
              appleConfig.privateKeyLocation || 'placeholder-key.p8',
          }),
      callbackURL: appleConfig.callbackURL,
      scope: ['email', 'name'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    idTokenOrProfile: any,
  ) {
    // 1. Get raw idToken from body or arguments
    const rawIdToken =
      req.body?.id_token ||
      (typeof idTokenOrProfile === 'string' ? idTokenOrProfile : undefined);

    let appleId = req.appleProfile?.id;
    let email = req.appleProfile?.email;

    // 2. Decode id_token payload to extract appleId (sub) and email
    if (rawIdToken && typeof rawIdToken === 'string') {
      try {
        const parts = rawIdToken.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8'),
          );
          if (payload.sub) appleId = payload.sub;
          if (payload.email) email = payload.email;
        }
      } catch (e) {
        // ignore decode error
      }
    }

    // 3. Extract user name (Apple sends this only on first sign-in in req.body.user)
    let username = 'Apple User';
    if (req.appleProfile?.name) {
      username = [
        req.appleProfile.name.firstName,
        req.appleProfile.name.lastName,
      ]
        .filter(Boolean)
        .join(' ');
    } else if (req.body?.user) {
      try {
        const userObj =
          typeof req.body.user === 'string'
            ? JSON.parse(req.body.user)
            : req.body.user;
        if (userObj?.name) {
          username = [userObj.name.firstName, userObj.name.lastName]
            .filter(Boolean)
            .join(' ');
        }
        if (!email && userObj?.email) {
          email = userObj.email;
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    // 4. Validate or create user and return it directly (NestJS handles the passport callback)
    const user = await this.authService.validateAppleUser({
      email,
      username: username || 'Apple User',
      appleId,
    });

    return user;
  }
}
