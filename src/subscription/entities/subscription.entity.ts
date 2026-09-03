import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionStatus {
  PENDING = 'pending', // awaiting first successful payment
  ACTIVE = 'active',
  PAST_DUE = 'past_due', // renewal failed, inside grace period
  EXPIRED = 'expired',
}

export type PaymentMethodType = 'card' | 'apple_pay' | 'wallet';

@Schema({ _id: false })
export class SubscriptionPaymentMethod {
  @Prop({ enum: ['card', 'apple_pay', 'wallet'] })
  type?: PaymentMethodType;

  @Prop()
  tokenEncrypted?: string; // never store raw tokens

  @Prop()
  cardMask?: string;

  @Prop()
  cardType?: string;
}

const SubscriptionPaymentMethodSchema = SchemaFactory.createForClass(
  SubscriptionPaymentMethod,
);

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: true })
  planId: Types.ObjectId;

  // Snapshot the plan's terms at time of purchase — price changes to the
  // live plan must never retroactively affect an existing subscriber.
  @Prop({ required: true })
  planCode: string;

  @Prop({ required: true })
  planName: string;

  @Prop({ required: true })
  planPriceCentsSnapshot: number;

  /** VAT % locked at time of purchase — typically 14 */
  @Prop({ required: true, default: 14 })
  planVatPercentSnapshot: number;

  /** Total charged (base + VAT) locked at time of purchase */
  @Prop({ required: true })
  planTotalCentsSnapshot: number;

  @Prop({ required: true })
  planDurationDaysSnapshot: number;

  @Prop({
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
    index: true,
  })
  status: SubscriptionStatus;

  @Prop({ default: true })
  autoRenew: boolean;

  // Netflix-style cancel: access continues until currentPeriodEnd
  @Prop({ default: false })
  cancelAtPeriodEnd: boolean;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop()
  graceEndsAt?: Date;

  @Prop()
  nextRetryAt?: Date;

  @Prop({ default: 0 })
  failedRenewalAttempts: number;

  @Prop({ type: SubscriptionPaymentMethodSchema })
  paymentMethod?: SubscriptionPaymentMethod;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
SubscriptionSchema.index({ status: 1, nextRetryAt: 1 });

// Unique partial index — enforces at most one non-expired subscription per user
// at the database level. This is the authoritative concurrency barrier that
// prevents duplicate active/pending subscriptions regardless of application
// concurrency or horizontal scaling. EXPIRED subscriptions are excluded so
// users can freely re-subscribe after their subscription lapses.
SubscriptionSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'active', 'past_due'] },
    },
    name: 'unique_active_subscription_per_user',
  },
);
