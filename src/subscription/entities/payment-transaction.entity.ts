import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentTransactionDocument = PaymentTransaction & Document;

export enum TransactionType {
  INITIAL = 'initial',
  RENEWAL = 'renewal',
  MANUAL_GRANT = 'manual_grant',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true, index: true })
  subscriptionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: true })
  planId: Types.ObjectId;

  @Prop({ enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ required: true })
  amountCents: number;

  @Prop({ required: true, default: 'EGP' })
  currency: string;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  // Unique + sparse: idempotency guard against duplicate webhook delivery
  @Prop({ unique: true, sparse: true })
  paymobTransactionId?: string;

  @Prop()
  failureReason?: string;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
