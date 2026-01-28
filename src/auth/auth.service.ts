import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { EmailService } from 'src/email/email.service';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { normalizeEmail } from './utils/normalize-email';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Login user and return access + refresh tokens
   */
  async login(loginDto: LoginDto, deviceInfo?: string, ipAddress?: string) {
    const email = normalizeEmail(loginDto.email);
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const userPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const refreshToken = this.tokenService.generateRefreshToken(userPayload);

    // Store refresh token in database
    await this.tokenService.storeRefreshToken(
      user._id.toString(),
      refreshToken,
      deviceInfo,
      ipAddress,
    );

    // Exclude password and OTP fields from response
    const {
      password,
      emailVerificationOTP,
      emailVerificationOTPExpires,
      passwordResetOTP,
      passwordResetOTPExpires,
      ...userWithoutSensitiveData
    } = user.toObject();

    return {
      user: userWithoutSensitiveData,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Register new user and send verification OTP
   */
  async register(registerDto: RegisterDto) {
    const email = normalizeEmail(registerDto.email);
    const userExists = await this.usersService.findByEmail(email);
    
    // If user exists and email is already verified, throw error
    if (userExists && userExists.isEmailVerified) {
      throw new ConflictException('Email already registered');
    }

    // Generate OTP using OTP service
    const otp = this.otpService.generateOTP();
    const otpExpires = this.otpService.getOtpExpiryDate();

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // If user exists but email is not verified, update their info and resend OTP
    if (userExists && !userExists.isEmailVerified) {
      // Update user with new registration data
      await this.usersService.update(userExists._id, {
        username: registerDto.username,
        password: hashedPassword,
        phoneNumber: registerDto.phoneNumber,
      });

      // Update OTP
      await this.usersService.updateOTP(userExists._id.toString(), {
        emailVerificationOTP: otp,
        emailVerificationOTPExpires: otpExpires,
      });

      // Send OTP email
      await this.emailService.sendVerificationOTP(email, otp);

      return {
        success: true,
        message:
          'A new verification code has been sent to your email. Please verify to complete registration.',
        email,
      };
    }

    // Create new user
    const newUser = await this.usersService.create({
      ...registerDto,
      email,
      password: hashedPassword,
    });

    // Save OTP to user
    await this.usersService.updateOTP(newUser.user._id.toString(), {
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
    });

    // Send OTP email
    await this.emailService.sendVerificationOTP(email, otp);

    return {
      success: true,
      message:
        'Registration successful. Please check your email for verification code.',
      email,
    };
  }

  /**
   * Verify email with OTP
   */
  async verifyEmail(email: string, otp: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

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

  /**
   * Resend verification OTP
   */
  async resendVerificationOTP(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

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

    await this.emailService.sendVerificationOTP(normalizedEmail, otp);

    return {
      success: true,
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Forgot password - send reset OTP
   */
  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

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
    });

    await this.emailService.sendPasswordResetOTP(normalizedEmail, otp);

    return {
      success: true,
      message: 'Password reset code sent to your email',
    };
  }

  /**
   * Verify reset OTP (optional - verify before allowing password change)
   */
  async verifyResetOTP(email: string, otp: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

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

    return {
      success: true,
      message: 'OTP verified. You can now reset your password.',
    };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await this.usersService.updatePassword(user._id.toString(), hashedPassword);
    await this.usersService.updateOTP(user._id.toString(), {
      passwordResetOTP: null,
      passwordResetOTPExpires: null,
    });

    // Revoke all refresh tokens for security
    await this.revokeAllUserTokens(user._id.toString());

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Refresh tokens with rotation (single-use refresh tokens)
   */
  async refreshTokens(
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    // Verify and check reuse via TokenService
    const { payload, storedToken } = await this.tokenService.verifyRefreshToken(
      refreshToken,
    );

    // Delete the old refresh token (single-use)
    await this.tokenService.deleteRefreshToken(storedToken._id.toString());

    // Get the user
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    const userPayload = {
      sub: user._id.toString(), // Ensure consistency 'sub' vs 'id'
      email: user.email,
      role: user.role,
    };

    const newAccessToken = this.tokenService.generateAccessToken(userPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken(userPayload);

    // Store the new refresh token
    await this.tokenService.storeRefreshToken(
      user._id.toString(),
      newRefreshToken,
      deviceInfo || storedToken.deviceInfo,
      ipAddress || storedToken.ipAddress,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout - revoke the specific refresh token
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokenService.revokeRefreshToken(refreshToken);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices - revoke all refresh tokens for the user
   */
  async revokeAllUserTokens(userId: string): Promise<{ message: string }> {
    await this.tokenService.revokeAllUserTokens(userId);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string) {
    return this.tokenService.getActiveSessions(userId);
  }

  /**
   * Clean up unverified users with expired OTPs
   */
  async cleanupUnverifiedUsers() {
    const result = await this.usersService.deleteUnverifiedExpiredUsers();
    return {
      success: true,
      message: `Cleaned up ${result.deletedCount} unverified users with expired OTPs`,
      deletedCount: result.deletedCount,
    };
  }
}
