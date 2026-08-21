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
      ? (appleConfig.privateKey.includes('-----BEGIN PRIVATE KEY-----')
          ? appleConfig.privateKey
          : `-----BEGIN PRIVATE KEY-----\n${appleConfig.privateKey.trim()}\n-----END PRIVATE KEY-----`)
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
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    try {
      const email = profile?.email;
      const appleId = profile?.id;
      const username = profile?.name
        ? [profile.name.firstName, profile.name.lastName]
            .filter(Boolean)
            .join(' ')
        : 'Apple User';

      const user = await this.authService.validateAppleUser({
        email,
        username: username || 'Apple User',
        appleId,
      });

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}
