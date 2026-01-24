import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true })
  token: string; // Hashed refresh token

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: false })
  deviceInfo: string; // Browser/device info (User-Agent)

  @Prop({ required: false })
  ipAddress: string; // Client IP address

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop({ required: true })
  expiresAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Index for faster lookups and auto-cleanup of expired tokens
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ token: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index - auto-delete expired tokens
