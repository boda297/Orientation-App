import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;

  @Prop({ required: false, default: null })
  logoUrl?: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: false, default: null })
  mapsLocation?: string;

  @Prop({ enum: ['PLANNING', 'CONSTRUCTION', 'COMPLETED', 'DELIVERED'] })
  status: 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED';

  @Prop({ type: Types.ObjectId, ref: 'Developer', required: true })
  developer: Types.ObjectId;

  @Prop({ required: true })
  script: string;

  @Prop({ required: true })
  projectThumbnailUrl: string;

  @Prop({ default: false })
  featured: boolean;

  @Prop({ type: [Types.ObjectId], ref: 'Episode' })
  episodes: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Reel' })
  reels: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Inventory' })
  inventory: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'File' })
  pdf: Types.ObjectId[];

  @Prop({ required: true })
  heroVideoUrl: string;

  @Prop({ type: String, required: false })
  whatsappNumber?: string;

  @Prop({ default: 0 })
  trendingScore: number;

  @Prop({ default: 0 })
  saveCount: number;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: false })
  published: boolean;

  @Prop({ required: false })
  publishedAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Single field indexes
ProjectSchema.index({ developerId: 1 }); // Filter by developer

// Compound indexes following ESR rule (Equality, Sort, Range)
// Most queries exclude deleted items, so deletedAt should be first in compound indexes
ProjectSchema.index({ deletedAt: 1, publishedAt: -1 }); // Most common: active projects sorted by newest
ProjectSchema.index({ deletedAt: 1, featured: 1, trendingScore: -1 }); // Featured + trending (excludes deleted)
ProjectSchema.index({ deletedAt: 1, developerId: 1 }); // Developer's active projects
ProjectSchema.index({ deletedAt: 1, location: 1 }); // Location search (excludes deleted)
ProjectSchema.index({ deletedAt: 1, tags: 1 }); // Tag search (excludes deleted)
ProjectSchema.index({ deletedAt: 1, status: 1 }); // Filter by status (excludes deleted)

// Additional useful compound indexes
ProjectSchema.index({ deletedAt: 1, location: 1, publishedAt: -1 }); // Location + newest
ProjectSchema.index({ deletedAt: 1, tags: 1, publishedAt: -1 }); // Tags + newest
ProjectSchema.index({ deletedAt: 1, price: 1 }); // Price filtering (if needed)
ProjectSchema.index({ deletedAt: 1, developerId: 1, publishedAt: -1 }); // Developer's projects sorted by newest
