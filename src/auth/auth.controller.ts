import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
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
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleMobileDto } from './dto/google-mobile.dto';
import { AppleAuthGuard } from './guards/apple-auth.guard';
import { AppleMobileDto } from './dto/apple-mobile.dto';

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
  async refresh(@Req() req, @Res({ passthrough: true }) res: Response) {
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
  async signout(@Req() req, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    return this.authService.signout(req.user.sub);
  }

  @Public()
  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async googleLogin() {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    const user = req.user;
    const response = await this.authService.login(user._id, user.role);

    res.cookie('accessToken', response.accessToken, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,
    });
    res.cookie('refreshToken', response.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://orientationapps.com';
    res.redirect(`${frontendUrl}?token=${response.accessToken}`);
  }

  // Native Mobile Google Sign-In (Flutter, React Native, iOS, Android)
  @Public()
  @Post('google/mobile')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async googleMobileLogin(
    @Body() googleMobileDto: GoogleMobileDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.validateGoogleIdToken(
      googleMobileDto.idToken,
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

  // ==================== APPLE AUTHENTICATION ====================

  @Public()
  @Get('apple/login')
  @UseGuards(AppleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async appleLogin() {}

  @Public()
  @Post('apple/callback')
  @UseGuards(AppleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async appleAuthCallback(@Req() req, @Res() res: Response) {
    const user = req.user;
    const response = await this.authService.login(user._id, user.role);

    res.cookie('accessToken', response.accessToken, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,
    });
    res.cookie('refreshToken', response.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://orientationapps.com';
    res.redirect(`${frontendUrl}?token=${response.accessToken}`);
  }

  // Native Mobile Apple Sign-In (Flutter, React Native, iOS)
  @Public()
  @Post('apple/mobile')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async appleMobileLogin(
    @Body() appleMobileDto: AppleMobileDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result =
      await this.authService.validateAppleIdToken(appleMobileDto);

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
