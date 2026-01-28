import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../entities/refresh-token.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  /**
   * Hash a token using SHA-256
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a short-lived access token
   */
  generateAccessToken(payload: JwtPayload): string {
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  /**
   * Generate a longer-lived refresh token
   */
  generateRefreshToken(payload: JwtPayload): string {
    const expiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  /**
   * Calculate expiry date from duration string
   */
  calculateExpiryDate(duration: string): Date {
    const now = new Date();
    const value = parseInt(duration.slice(0, -1), 10);
    const unit = duration.slice(-1);

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 's':
        now.setSeconds(now.getSeconds() + value);
        break;
      default:
        now.setDate(now.getDate() + 7); // Default to 7 days
    }

    return now;
  }

  /**
   * Store a hashed refresh token in the database
   */
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    const expiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = this.calculateExpiryDate(expiresIn);

    await this.refreshTokenModel.create({
      token: hashedToken,
      userId,
      deviceInfo,
      ipAddress,
      expiresAt,
      isRevoked: false,
    });
  }

  /**
   * Verify refresh token and check database
   */
  async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const hashedToken = this.hashToken(refreshToken);
      const storedToken = await this.refreshTokenModel.findOne({
        token: hashedToken,
        userId: payload.sub,
        isRevoked: false,
      });

      if (!storedToken) {
        // Reuse detection: revoke all
        await this.revokeAllUserTokens(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions revoked.',
        );
      }

      return { payload, storedToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Delete a specific refresh token (used during rotation or logout)
   */
  async deleteRefreshToken(id: string): Promise<void> {
    await this.refreshTokenModel.deleteOne({ _id: id });
  }

  /**
   * Revoke a refresh token by value (logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    await this.refreshTokenModel.deleteOne({ token: hashedToken });
  }

  /**
   * Revoke all user tokens
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ userId });
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(userId: string) {
    return this.refreshTokenModel
      .find({ userId, isRevoked: false })
      .select('deviceInfo ipAddress createdAt expiresAt')
      .sort({ createdAt: -1 });
  }
}
