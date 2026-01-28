import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/entities/user.entity';

export type WatchHistoryDocument = WatchHistory & Document;

@Schema({ timestamps: true })
export class WatchHistory {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  contentId: string;

  @Prop({ required: true })
  contentTitle: string;

  @Prop({ required: false })
  contentThumbnail?: string;

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
  contentType?: string; // 'movie' | 'series' | 'episode'

  @Prop({ required: false })
  season?: number;

  @Prop({ required: false })
  episode?: number;
}

export const WatchHistorySchema = SchemaFactory.createForClass(WatchHistory);

// Each user can only have one entry per contentId
WatchHistorySchema.index({ userId: 1, contentId: 1 }, { unique: true });
WatchHistorySchema.index({ userId: 1, lastWatchedAt: -1 });

