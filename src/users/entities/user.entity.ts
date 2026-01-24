import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: false })
  phoneNumber: string;

  @Prop({ type: [Types.ObjectId], ref: 'Project' })
  savedProjects: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Reel' })
  savedReels: Types.ObjectId[];

  @Prop({
    type: String,
    required: false,
    default: 'user',
    enum: ['user', 'admin', 'developer', 'superadmin'],
  })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
