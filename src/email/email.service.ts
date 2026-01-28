import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Generate 4-digit OTP
   */
  generateOTP(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Send Email Verification OTP
   */
  async sendVerificationOTP(email: string, otp: string): Promise<void> {
    const mailOptions = {
      from: `"Orientation App" <${this.configService.get('SMTP_FROM')}>`,
      to: email,
      subject: 'Email Verification Code - Orientation',
      text: `Your verification code is: ${otp}\n\nThis code will expire in 2 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification OTP sent to ${email}`);
    } catch (error) {
      this.logger.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send Password Reset OTP
   */
  async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    const mailOptions = {
      from: `"Orientation App" <${this.configService.get('SMTP_FROM')}>`,
      to: email,
      subject: 'Password Reset Code - Orientation',
      text: `Your password reset code is: ${otp}\n\nThis code will expire in 2 minutes.\n\nIf you didn't request a password reset, please ignore this email.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset OTP sent to ${email}`);
    } catch (error) {
      this.logger.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send "Join Developer" request notification to admin email
   */
  async sendJoinDeveloperRequest(
    toEmail: string,
    payload: {
      userId?: string;
      userEmail?: string;
      name: string;
      address: string;
      phoneNumber: string;
      numberOfProjects: number;
      socialmediaLink: string;
      notes?: string;
    },
  ): Promise<void> {
    const mailOptions = {
      from: `"Orientation App" <${this.configService.get('SMTP_FROM')}>`,
      to: toEmail,
      subject: `Join Developer Request - ${payload.name}`,
      text: [
        'A new Join Developer request was submitted.',
        '',
        `User ID: ${payload.userId || 'N/A'}`,
        `User Email: ${payload.userEmail || 'N/A'}`,
        '',
        `Name: ${payload.name}`,
        `Address: ${payload.address}`,
        `Phone: ${payload.phoneNumber}`,
        `Number of Projects: ${payload.numberOfProjects}`,
        `Social Link: ${payload.socialmediaLink}`,
        `Notes: ${payload.notes || 'N/A'}`,
        '',
        `Submitted At: ${new Date().toISOString()}`,
      ].join('\n'),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Join Developer request sent to ${toEmail}`);
    } catch (error) {
      this.logger.error('Error sending join developer request email:', error);
      throw new Error('Failed to send join developer request email');
    }
  }
}
