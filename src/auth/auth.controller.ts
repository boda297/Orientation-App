import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { ResetPasswordDto } from './dto/reset-password.dto';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== AUTHENTICATION ====================

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    const result = await this.authService.login(user.id, user.role);

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshToken(
      req.user.sub,
      req.user.role,
    );

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signout(
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    return this.authService.signout(req.user.sub);
  }

  // ==================== EMAIL VERIFICATION ====================

  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  resendVerificationOTP(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationOTP(resendDto.email);
  }

  // ==================== PASSWORD RESET ====================

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Post('verify-reset-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  verifyResetOTP(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyResetOTP(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

}
