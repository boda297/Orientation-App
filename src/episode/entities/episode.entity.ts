import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EpisodeDocument = Episode & Document;

@Schema({ timestamps: true })
export class Episode {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: false, default: null })
  thumbnail?: string;

  @Prop({ required: true })
  episodeUrl: string;

  @Prop({ required: true })
  episodeOrder: string;

  @Prop({ required: false })
  duration?: string;

  @Prop({ required: true })
  s3Key: string;
}

export const EpisodeSchema = SchemaFactory.createForClass(Episode);
