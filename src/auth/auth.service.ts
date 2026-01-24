import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './entities/refresh-token.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a short-lived access token (default: 15 minutes)
   */
  private generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  /**
   * Generate a longer-lived refresh token (default: 7 days)
   */
  private generateRefreshToken(user: {
    id: string;
    email: string;
    role: string;
  }): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  /**
   * Store a hashed refresh token in the database
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);

    // Calculate expiry date based on JWT_REFRESH_EXPIRES_IN
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = this.calculateExpiryDate(expiresIn);

    await this.refreshTokenModel.create({
      token: hashedToken,
      userId,
      deviceInfo,
      ipAddress,
      expiresAt,
    });
  }

  /**
   * Calculate expiry date from duration string (e.g., '7d', '24h', '30m')
   */
  private calculateExpiryDate(duration: string): Date {
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
   * Login user and return access + refresh tokens
   */
  async login(loginDto: LoginDto, deviceInfo?: string, ipAddress?: string) {
    const user = await this.usersService.findByEmail(loginDto.email);
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

    const userPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken(userPayload);

    // Store refresh token in database
    await this.storeRefreshToken(
      user._id.toString(),
      refreshToken,
      deviceInfo,
      ipAddress,
    );

    // Exclude password from response
    const { password, ...userWithoutPassword } = user.toObject();

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Register new user and return access + refresh tokens
   */
  async register(registerDto: RegisterDto, deviceInfo?: string, ipAddress?: string) {
    const userExists = await this.usersService.findByEmail(registerDto.email);
    if (userExists) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const newUser = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const userPayload = {
      id: newUser.user._id.toString(),
      email: newUser.user.email,
      role: newUser.user.role,
    };

    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken(userPayload);

    // Store refresh token in database
    await this.storeRefreshToken(
      newUser.user._id.toString(),
      refreshToken,
      deviceInfo,
      ipAddress,
    );

    // Exclude password from response
    const { password, ...userWithoutPassword } = newUser.user.toObject();

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh tokens with rotation (single-use refresh tokens)
   * - Validates the refresh token
   * - Deletes the old refresh token (invalidates it)
   * - Generates new access + refresh tokens
   * - Stores the new refresh token
   */
  async refreshTokens(
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    try {
      // 1. Verify the refresh token JWT
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // 2. Hash the token and find it in the database
      const hashedToken = this.hashToken(refreshToken);
      const storedToken = await this.refreshTokenModel.findOne({
        token: hashedToken,
        userId: payload.sub,
        isRevoked: false,
      });

      // 3. If token not found, it may have been reused (attack detected)
      if (!storedToken) {
        // Security: Revoke all tokens for this user (potential attack)
        await this.revokeAllUserTokens(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked.',
        );
      }

      // 4. Delete the old refresh token (single-use)
      await this.refreshTokenModel.deleteOne({ _id: storedToken._id });

      // 5. Get the user
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 6. Generate new tokens
      const userPayload = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      const newAccessToken = this.generateAccessToken(userPayload);
      const newRefreshToken = this.generateRefreshToken(userPayload);

      // 7. Store the new refresh token
      await this.storeRefreshToken(
        user._id.toString(),
        newRefreshToken,
        deviceInfo || storedToken.deviceInfo,
        ipAddress || storedToken.ipAddress,
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout - revoke the specific refresh token
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    const hashedToken = this.hashToken(refreshToken);
    await this.refreshTokenModel.deleteOne({ token: hashedToken });
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices - revoke all refresh tokens for the user
   */
  async revokeAllUserTokens(userId: string): Promise<{ message: string }> {
    await this.refreshTokenModel.deleteMany({ userId });
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string) {
    const tokens = await this.refreshTokenModel
      .find({ userId, isRevoked: false })
      .select('deviceInfo ipAddress createdAt expiresAt')
      .sort({ createdAt: -1 });

    return tokens;
  }
}
