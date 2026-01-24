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
import { AuthGuard } from './auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
    return this.authService.login(loginDto, deviceInfo, ipAddress);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto, @Req() req: AuthenticatedRequest) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
    return this.authService.register(registerDto, deviceInfo, ipAddress);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshTokenDto, @Req() req: AuthenticatedRequest) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
    return this.authService.refreshTokens(body.refreshToken, deviceInfo, ipAddress);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    return this.authService.revokeAllUserTokens(userId!);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  getActiveSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    return this.authService.getActiveSessions(userId!);
  }
}
