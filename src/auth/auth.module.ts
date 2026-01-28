import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from 'src/email/email.module';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './entities/refresh-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is not defined');
        }
        const expiresIn =
          configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
      inject: [ConfigService],
    }),
    forwardRef(() => UsersModule),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, OtpService, TokenService],
  exports: [JwtAuthGuard, JwtStrategy, OtpService, TokenService],
})
export class AuthModule {}

