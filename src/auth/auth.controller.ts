import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

@Controller('auth')
@UseGuards(JwtAuthGuard) // Apply guard globally to all routes
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== AUTHENTICATION ====================

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket.remoteAddress;
    return this.authService.login(loginDto, deviceInfo, ipAddress);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshTokenDto, @Req() req: AuthenticatedRequest) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket.remoteAddress;
    return this.authService.refreshTokens(
      body.refreshToken,
      deviceInfo,
      ipAddress,
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser('sub') userId: string) {
    return this.authService.revokeAllUserTokens(userId);
  }

  @Get('sessions')
  getActiveSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getActiveSessions(userId);
  }

  // ==================== EMAIL VERIFICATION ====================

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerificationOTP(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationOTP(resendDto.email);
  }

  // ==================== PASSWORD RESET ====================

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  verifyResetOTP(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyResetOTP(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
  }

  // ==================== ADMIN UTILITIES ====================

  /**
   * Cleanup unverified users with expired OTPs
   * This endpoint can be called manually or via a cron job
   */
  @Public()
  @Post('cleanup-unverified')
  @HttpCode(HttpStatus.OK)
  cleanupUnverifiedUsers() {
    return this.authService.cleanupUnverifiedUsers();
  }
}

