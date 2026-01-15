import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DeveloperDoc = Developer & Document;

@Schema({ timestamps: true })
export class Developer {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: false })
  email?: string;

  @Prop({required: true})
  phone: string;

  @Prop({ required: true })
  location: string;

  @Prop({ type: [Types.ObjectId], ref: 'Project' })
  projects: Types.ObjectId[];

  @Prop()
  deletedAt?: Date;

}

export const DeveloperSchema = SchemaFactory.createForClass(Developer);

// Indexes
DeveloperSchema.index({ name: 'text' });
