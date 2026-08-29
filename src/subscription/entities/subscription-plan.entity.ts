import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan {
  // Stable internal id e.g. 'plan_3_months' — never shown raw to users
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** Base price in smallest currency unit (piastres) — BEFORE VAT */
  @Prop({ required: true })
  priceCents: number;

  @Prop({ required: true, default: 'EGP' })
  currency: string;

  /** VAT percentage — default 14% (Egyptian VAT) */
  @Prop({ required: true, default: 14 })
  vatPercent: number;

  /** VAT amount in piastres — calculated and stored */
  @Prop({ required: true })
  vatCents: number;

  /** Total charged to customer (priceCents + vatCents) — calculated and stored */
  @Prop({ required: true })
  totalCents: number;

  /** Duration in days — 90 days = 3 months, 180 days = 6 months, etc. */
  @Prop({ required: true })
  durationDays: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  // Archiving instead of deleting keeps existing subscribers' history intact
  @Prop({ default: true })
  isActive: boolean;

  /** Unique order index for display sorting in frontend */
  @Prop({ required: true, unique: true })
  sortOrder: number;
}

export const SubscriptionPlanSchema =
  SchemaFactory.createForClass(SubscriptionPlan);
