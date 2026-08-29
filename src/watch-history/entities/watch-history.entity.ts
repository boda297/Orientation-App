import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/entities/user.entity';

export type WatchHistoryDocument = WatchHistory & Document;

@Schema({ timestamps: true })
export class WatchHistory {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  projectTitle: string;

  @Prop({ required: true, index: true })
  contentId: string;

  @Prop({ required: true, trim: true })
  contentTitle: string;

  @Prop({ required: false, default: null })
  contentThumbnail?: string;

  @Prop({ required: false, default: null })
  episodeUrl?: string;

  @Prop({ required: false, default: 'episode' })
  contentType?: string; // 'episode' | 'reel' | 'video'

  @Prop({ required: true, min: 0 })
  currentTime: number;

  @Prop({ required: true, min: 0 })
  duration: number;

  @Prop({ required: true, min: 0, max: 100 })
  progressPercentage: number;

  @Prop({ required: true, default: false })
  completed: boolean;

  @Prop({ required: true, default: Date.now, index: true })
  lastWatchedAt: Date;

  @Prop({ required: false })
  season?: number;

  @Prop({ required: false })
  episode?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const WatchHistorySchema = SchemaFactory.createForClass(WatchHistory);

// Compound indexes
WatchHistorySchema.index({ userId: 1, contentId: 1 }, { unique: true });
WatchHistorySchema.index({ userId: 1, lastWatchedAt: -1 });
WatchHistorySchema.index({ userId: 1, completed: 1, updatedAt: -1 });

