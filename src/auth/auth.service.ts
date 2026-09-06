import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { EmailService } from 'src/email/email.service';
import { OtpService } from './services/otp.service';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import refreshJwtConfig from './config/refresh-jwt.config';
import { ConfigType } from '@nestjs/config';
import { Types } from 'mongoose';
import { AuthJwtPayload } from './types/auth-jwtPayload';
import * as argon2 from 'argon2';
import googleOauthConfig from './config/google-oauth.config';
import appleOauthConfig from './config/apple-oauth.config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { AppleMobileDto } from './dto/apple-mobile.dto';

@Injectable()
export class AuthService {
  private googleOAuthClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly otpService: OtpService,
    private jwtService: JwtService,
    @Inject(refreshJwtConfig.KEY)
    private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
    @Inject(googleOauthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleOauthConfig>,
    @Inject(appleOauthConfig.KEY)
    private appleConfiguration: ConfigType<typeof appleOauthConfig>,
  ) {
    this.googleOAuthClient = new OAuth2Client();
  }

  // Validate user credentials
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) {
      throw new UnauthorizedException(
        'This account was registered using Google. Please log in with Google or reset your password to create one.',
      );
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch)
      throw new UnauthorizedException('Invalid credentials');

    return { id: user._id, role: user.role };
  }

  // Login user and return access + refresh tokens
  async login(userId: Types.ObjectId, role?: string) {
    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      role,
    );
    // hash refresh token
    const hashedRefreshToken = await argon2.hash(refreshToken);
    // store hashed refresh token in user document
    await this.usersService.updateHashedRefreshToken(
      userId,
      hashedRefreshToken,
    );
    return { id: userId, accessToken, refreshToken };
  }

  // Generate access and refresh tokens
  async generateTokens(userId: Types.ObjectId, role?: string) {
    // 1. create payload with user id and role
    const payload: AuthJwtPayload = { sub: userId, role: role };
    // 2. generate access and refresh tokens
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshJwtConfiguration),
    ]);

    return { accessToken, refreshToken };
  }

  // Validate refresh token
  async validateRefreshToken(userId: Types.ObjectId, refreshToken: string) {
    // 1. Find user by id
    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRefreshToken)
      throw new UnauthorizedException('Invalid Refresh Token');
    // 2. Verify refresh token
    const isRefreshTokenMatch = await argon2.verify(
      user.hashedRefreshToken,
      refreshToken,
    );

    if (!isRefreshTokenMatch)
      throw new UnauthorizedException('Invalid Refresh Token');
    return { sub: user._id, role: user.role };
  }

  // refreshtoken
  async refreshToken(userId: Types.ObjectId, role?: string) {
    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      role,
    );
    // hash refresh token
    const hashedRefreshToken = await argon2.hash(refreshToken);
    // store hashed refresh token in user document
    await this.usersService.updateHashedRefreshToken(
      userId,
      hashedRefreshToken,
    );
    return { id: userId, accessToken, refreshToken };
  }

  // Register new user and send verification OTP
  async register(registerDto: RegisterDto) {
    const email = registerDto.email;
    const userExists = await this.usersService.findByEmail(email);

    // 1. If user exists and email is already verified, throw error
    if (userExists && userExists.isEmailVerified) {
      throw new ConflictException('Email already registered');
    }

    // 2. Generate OTP using OTP service
    const otp = this.otpService.generateOTP();
    const otpExpires = this.otpService.getOtpExpiryDate();

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 4. If user exists but email is not verified, update their info and resend OTP
    if (userExists && !userExists.isEmailVerified) {
      // Update user with new registration data
      await this.usersService.update(userExists._id, {
        username: registerDto.username,
        password: hashedPassword,
        phoneNumber: registerDto.phoneNumber,
      });

      // 5. Update OTP
      await this.usersService.updateOTP(userExists._id.toString(), {
        emailVerificationOTP: otp,
        emailVerificationOTPExpires: otpExpires,
      });

      // 6. Send OTP email
      await this.emailService.sendVerificationOTP(email, otp);

      return {
        success: true,
        message:
          'A new verification code has been sent to your email. Please verify to complete registration.',
        email,
      };
    }

    // 7. Create new user
    const newUser = await this.usersService.create({
      ...registerDto,
      email,
      password: hashedPassword,
    });

    // 8. Save OTP to user
    await this.usersService.updateOTP(newUser.user._id.toString(), {
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
    });

    // 9. Send OTP email
    await this.emailService.sendVerificationOTP(email, otp);

    return {
      success: true,
      message:
        'Registration successful. Please check your email for verification code.',
      email,
    };
  }

  // Verify email with OTP
  async verifyEmail(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const validationResult = this.otpService.validateOtp(
      otp,
      user.emailVerificationOTP,
      user.emailVerificationOTPExpires,
    );

    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.error);
    }

    // Mark email as verified and clear OTP
    await this.usersService.updateOTP(user._id.toString(), {
      isEmailVerified: true,
      emailVerificationOTP: null,
      emailVerificationOTPExpires: null,
    });

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  // Resend verification OTP
  async resendVerificationOTP(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new OTP
    const otp = this.otpService.generateOTP();
    const otpExpires = this.otpService.getOtpExpiryDate();

    await this.usersService.updateOTP(user._id.toString(), {
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
    });

    await this.emailService.sendVerificationOTP(email, otp);

    return {
      success: true,
      message: 'Verification code sent to your email',
    };
  }

  // Forgot password - send reset OTP
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists for security
      return {
        success: true,
        message: 'If your email is registered, you will receive a reset code',
      };
    }

    // Generate OTP
    const otp = this.otpService.generateOTP();
    const otpExpires = this.otpService.getOtpExpiryDate();

    await this.usersService.updateOTP(user._id.toString(), {
      passwordResetOTP: otp,
      passwordResetOTPExpires: otpExpires,
      isPasswordResetVerified: false,
    });

    await this.emailService.sendPasswordResetOTP(email, otp);

    return {
      success: true,
      message: 'Password reset code sent to your email',
    };
  }

  // Verify reset OTP
  async verifyResetOTP(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const validationResult = this.otpService.validateOtp(
      otp,
      user.passwordResetOTP,
      user.passwordResetOTPExpires,
    );

    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.error);
    }

    // Mark password reset as verified and clear OTP code
    await this.usersService.updateOTP(user._id.toString(), {
      passwordResetOTP: null,
      isPasswordResetVerified: true,
    });

    return {
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
    };
  }

  async signout(userId: Types.ObjectId) {
    await this.usersService.updateHashedRefreshToken(userId, null);
    return {
      success: true,
      message: 'User signed out successfully',
    };
  }

  // Reset password after OTP has been verified
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, newPassword } = resetPasswordDto;

    // 1. Find user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 2. Check if password reset OTP was verified
    if (!user.isPasswordResetVerified) {
      throw new BadRequestException(
        'OTP must be verified before resetting password',
      );
    }

    // 3. Check if expiry has passed
    if (this.otpService.isOtpExpired(user.passwordResetOTPExpires)) {
      await this.usersService.updateOTP(user._id.toString(), {
        isPasswordResetVerified: false,
        passwordResetOTPExpires: null,
      });
      throw new BadRequestException(
        'Password reset session has expired. Please request a new OTP.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // 4. Update user password and clear reset state
    await this.usersService.updatePassword(
      user._id.toString(),
      hashedPassword,
    );
    await this.usersService.updateOTP(user._id.toString(), {
      passwordResetOTP: null,
      passwordResetOTPExpires: null,
      isPasswordResetVerified: false,
    });

    // 5. Invalidate active refresh tokens to force re-authentication
    await this.usersService.updateHashedRefreshToken(user._id, null);

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  async validateGoogleUser(googleUser: {
    email: string;
    username: string;
    googleId?: string;
  }) {
    const userExists = await this.usersService.findByEmail(googleUser.email);
    // If user exists: ensure email is verified and return user document
    if (userExists) {
      if (!userExists.isEmailVerified) {
        await this.usersService.update(userExists._id, {
          isEmailVerified: true,
        });
        userExists.isEmailVerified = true;
      }
      return userExists;
    }

    // If user does not exist: create new user without password (pure OAuth)
    const newUser = await this.usersService.createGoogleUser({
      email: googleUser.email,
      username: googleUser.username,
      provider: 'google',
      googleId: googleUser.googleId,
      isEmailVerified: true,
    });
    return newUser;
  }

  // Validate Google ID Token from Mobile Apps (Flutter, React Native, iOS, Android)
  async validateGoogleIdToken(idToken: string) {
    if (!idToken) {
      throw new BadRequestException('idToken is required');
    }

    try {
      const audiences = [
        this.googleConfiguration.clientId,
        this.googleConfiguration.iosClientId,
        this.googleConfiguration.androidClientId,
      ].filter((id): id is string => Boolean(id));

      const ticket = await this.googleOAuthClient.verifyIdToken({
        idToken,
        audience: audiences.length > 0 ? audiences : undefined,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google ID token payload');
      }

      const email = payload.email;
      const username =
        payload.name ||
        [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
        'Google User';
      const googleId = payload.sub;

      const user = await this.validateGoogleUser({
        email,
        username,
        googleId,
      });

      return await this.login(user._id, user.role);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException(
        `Google token verification failed: ${error.message}`,
      );
    }
  }

  // Validate or create user from Apple Profile
  async validateAppleUser(appleUser: {
    email?: string;
    username?: string;
    appleId: string;
  }) {
    if (!appleUser?.appleId || typeof appleUser.appleId !== 'string' || appleUser.appleId.trim() === '') {
      throw new BadRequestException('Valid Apple ID is required');
    }

    const cleanAppleId = appleUser.appleId.trim();

    // 1. Check if user already exists by appleId
    let user = await this.usersService.findByAppleId(cleanAppleId);
    if (user) {
      return user;
    }

    // 2. If email is provided, check if user exists by email (account linking)
    if (appleUser.email) {
      user = await this.usersService.findByEmail(appleUser.email);
      if (user) {
        await this.usersService.update(user._id, {
          appleId: cleanAppleId,
          isEmailVerified: true,
        });
        user.appleId = cleanAppleId;
        user.isEmailVerified = true;
        return user;
      }
    }

    // 3. If new user, create Apple account
    const email =
      appleUser.email || `${cleanAppleId}@privaterelay.appleid.com`;
    const username = appleUser.username || 'Apple User';

    const newUser = await this.usersService.createAppleUser({
      email,
      username,
      appleId: cleanAppleId,
      isEmailVerified: true,
    });

    return newUser;
  }

  // Validate Apple Identity Token from Mobile Apps (Flutter, React Native, iOS)
  async validateAppleIdToken(appleMobileDto: AppleMobileDto) {
    if (!appleMobileDto.identityToken) {
      throw new BadRequestException('identityToken is required');
    }

    try {
      const audiences = [
        this.appleConfiguration.clientID,
        this.appleConfiguration.bundleId,
      ].filter((id): id is string => Boolean(id));

      const { sub: appleId, email } = await appleSignin.verifyIdToken(
        appleMobileDto.identityToken,
        {
          audience: audiences.length > 0 ? audiences : undefined,
          ignoreExpiration: false,
        },
      );

      // Determine user name from mobile payload (sent only on first login)
      let username = 'Apple User';
      if (appleMobileDto.name) {
        username = [
          appleMobileDto.name.firstName,
          appleMobileDto.name.lastName,
        ]
          .filter(Boolean)
          .join(' ');
      } else if (appleMobileDto.firstName || appleMobileDto.lastName) {
        username = [appleMobileDto.firstName, appleMobileDto.lastName]
          .filter(Boolean)
          .join(' ');
      }

      const userEmail = email || appleMobileDto.email;

      const user = await this.validateAppleUser({
        email: userEmail,
        username: username || 'Apple User',
        appleId,
      });

      return await this.login(user._id, user.role);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException(
        `Apple token verification failed: ${error.message}`,
      );
    }
  }
}
