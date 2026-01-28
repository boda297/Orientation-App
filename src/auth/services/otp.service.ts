import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_OTP_EXPIRY_MINUTES, DEFAULT_OTP_LENGTH } from '../constants';

@Injectable()
export class OtpService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate a random OTP code
   * @param length - Length of OTP (default from config or 4)
   * @returns OTP string
   */
  generateOTP(length?: number): string {
    const otpLength =
      length ||
      this.configService.get<number>('OTP_LENGTH') ||
      DEFAULT_OTP_LENGTH;

    let otp = '';
    for (let i = 0; i < otpLength; i++) {
      otp += Math.floor(Math.random() * 10);
    }
    return otp;
  }

  /**
   * Get OTP expiry date based on configured minutes
   * @param expiryMinutes - Minutes until expiry (default from config or 2)
   * @returns Expiry date
   */
  getOtpExpiryDate(expiryMinutes?: number): Date {
    const minutes =
      expiryMinutes ||
      this.configService.get<number>('OTP_EXPIRY_MINUTES') ||
      DEFAULT_OTP_EXPIRY_MINUTES;

    return new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Check if OTP has expired
   * @param expiryDate - OTP expiry date
   * @returns true if expired, false otherwise
   */
  isOtpExpired(expiryDate: Date | null): boolean {
    if (!expiryDate) {
      return true;
    }
    return new Date() > expiryDate;
  }

  /**
   * Validate OTP
   * @param providedOtp - OTP provided by user
   * @param storedOtp - OTP stored in database
   * @param expiryDate - OTP expiry date
   * @returns Validation result with error message if invalid
   */
  validateOtp(
    providedOtp: string,
    storedOtp: string | null,
    expiryDate: Date | null,
  ): { valid: boolean; error?: string } {
    if (!storedOtp) {
      return {
        valid: false,
        error: 'No OTP found. Please request a new one.',
      };
    }

    if (providedOtp !== storedOtp) {
      return {
        valid: false,
        error: 'Invalid OTP code.',
      };
    }

    if (this.isOtpExpired(expiryDate)) {
      return {
        valid: false,
        error: 'OTP has expired. Please request a new one.',
      };
    }

    return { valid: true };
  }

  /**
   * Get OTP expiry time in minutes from config
   * @returns Expiry time in minutes
   */
  getOtpExpiryMinutes(): number {
    return (
      this.configService.get<number>('OTP_EXPIRY_MINUTES') ||
      DEFAULT_OTP_EXPIRY_MINUTES
    );
  }
}
