import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileDocument = File & Document;

@Schema({ timestamps: true })
export class File {
  @Prop({ required: true })
  pdfUrl: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Developer' })
  developer: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
  project: Types.ObjectId;

  @Prop({ required: true, unique: true })
  s3Key: string;
}

export const FileSchema = SchemaFactory.createForClass(File);
