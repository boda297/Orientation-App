import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema({ timestamps: true })
export class Inventory {
  @Prop({ required: true, unique: true })
  inventoryUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, unique: true })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Developer', required: true })
  developer: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  s3Key: string;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
