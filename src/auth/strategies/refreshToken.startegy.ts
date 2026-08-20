import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import refreshJwtConfig from '../config/refresh-jwt.config';
import { AuthJwtPayload } from '../types/auth-jwtPayload';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'refresh-jwt',
) {
  constructor(
    @Inject(refreshJwtConfig.KEY)
    private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
    private readonly authService: AuthService,
  ) {
    const secret = refreshJwtConfiguration.secret as string;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment configuration');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refreshToken || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: AuthJwtPayload,
  ): Promise<AuthJwtPayload> {
    const refreshToken =
      req?.cookies?.refreshToken ||
      req.get('Authorization')?.replace('Bearer ', '').trim();
    const userId = payload.sub;
    return this.authService.validateRefreshToken(userId, refreshToken as string);
  }
}
