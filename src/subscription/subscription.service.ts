import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from './entities/subscription.entity';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
  TransactionStatus,
  TransactionType,
} from './entities/payment-transaction.entity';
import { PaymobService } from './integrations/paymob.service';
import { SubscriptionPlansService } from './plans/subscription-plans.service';
import { UsersService } from 'src/users/users.service';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';
import { encryptToken, decryptToken } from './utils/token-crypto.util';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly freeAccessAfterDays: number;
  private readonly gracePeriodDays: number;
  private readonly maxRenewalAttempts: number;
  private readonly retryIntervalsDays: number[];
  private readonly apiBaseUrl: string;
  private readonly frontendBaseUrl: string;

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(PaymentTransaction.name)
    private transactionModel: Model<PaymentTransactionDocument>,
    private readonly paymobService: PaymobService,
    private readonly plansService: SubscriptionPlansService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.freeAccessAfterDays = Number(
      this.configService.get('FREE_ACCESS_AFTER_DAYS') || 30,
    );
    this.gracePeriodDays = Number(
      this.configService.get('SUBSCRIPTION_GRACE_PERIOD_DAYS') || 3,
    );
    this.maxRenewalAttempts = Number(
      this.configService.get('SUBSCRIPTION_MAX_RENEWAL_ATTEMPTS') || 3,
    );
    this.retryIntervalsDays = (
      this.configService.get<string>('SUBSCRIPTION_RETRY_INTERVALS_DAYS') ||
      '1,3,5'
    )
      .split(',')
      .map(Number);
    this.apiBaseUrl = this.configService.get('API_BASE_URL') || '';
    this.frontendBaseUrl = this.configService.get('FRONTEND_BASE_URL') || '';
  }

  // ─────────────────────── Checkout ───────────────────────

  async initiateCheckout(userId: string, planId: string) {
    const plan = await this.plansService.findByIdOrThrow(planId);
    const user = await this.usersService.findById(new Types.ObjectId(userId));
    if (!user) throw new NotFoundException('User not found');

    // ── Fast-path guard ─────────────────────────────────────────────────
    const activeSubscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
    });
    if (activeSubscription) {
      throw new BadRequestException(
        'You already have an active subscription. Cancel it before subscribing to a different plan.',
      );
    }

    // ── Atomic find-or-create ────────────────────────────────────────────
    const planSnapshot = {
      planId: plan._id,
      planCode: plan.code,
      planName: plan.name,
      planPriceCentsSnapshot: plan.priceCents,
      planVatPercentSnapshot: plan.vatPercent,
      planTotalCentsSnapshot: plan.totalCents,
      planDurationDaysSnapshot: plan.durationDays,
    };

    let subscription: SubscriptionDocument;
    try {
      subscription = await this.subscriptionModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), status: SubscriptionStatus.PENDING },
        {
          $set: planSnapshot,
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            status: SubscriptionStatus.PENDING,
            autoRenew: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (err: any) {
      if (err?.code === 11000) {
        // The unique partial index fired: a concurrent request won the insert
        // race. The document now definitely exists — fetch and update it.
        const existing = await this.subscriptionModel.findOneAndUpdate(
          { userId: new Types.ObjectId(userId), status: SubscriptionStatus.PENDING },
          { $set: planSnapshot },
          { new: true },
        );
        if (!existing) {
          // Extremely unlikely: the concurrent request may have already been
          // paid and transitioned out of PENDING by the time we retry.
          throw new BadRequestException(
            'Subscription state conflict — please retry in a moment.',
          );
        }
        subscription = existing;
      } else {
        throw err;
      }
    }

    // ── Transaction & Paymob intention (idempotent) ─────────────────────
    const existingTransaction = await this.transactionModel.findOne({
      subscriptionId: subscription._id,
      status: TransactionStatus.PENDING,
      type: TransactionType.INITIAL,
    });

    if (
      existingTransaction &&
      existingTransaction.amountCents === subscription.planTotalCentsSnapshot &&
      existingTransaction.paymobClientSecret
    ) {
      // Same plan, same amount — reuse the existing checkout session.
      return {
        message: 'Checkout initiated',
        checkoutUrl: this.paymobService.buildUnifiedCheckoutUrl(
          existingTransaction.paymobClientSecret,
        ),
        subscriptionId: subscription._id,
      };
    }

    if (existingTransaction) {
      existingTransaction.status = TransactionStatus.CANCELLED;
      existingTransaction.failureReason = 'Superseded by plan change at checkout';
      await existingTransaction.save();
    }

    // Create a fresh transaction for this checkout session.
    const transaction = await this.transactionModel.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      planId: plan._id,
      type: TransactionType.INITIAL,
      amountCents: subscription.planTotalCentsSnapshot, // total incl. VAT
      currency: plan.currency,
      status: TransactionStatus.PENDING,
    });

    const { clientSecret } = await this.paymobService.createIntention({
      amountCents: subscription.planTotalCentsSnapshot, // charge total incl. VAT
      currency: plan.currency,
      specialReference: transaction._id.toString(),
      billing: this.buildBillingData(user),
      paymentMethods: this.paymobService.getCustomerPaymentMethodIds(),
      notificationUrl: `${this.apiBaseUrl}/subscriptions/webhook`,
      redirectionUrl: `${this.frontendBaseUrl}/subscribe/result`,
      extras: { subscriptionId: subscription._id.toString(), userId },
    });

    // Persist the clientSecret so future duplicate clicks get the same URL.
    transaction.paymobClientSecret = clientSecret;
    await transaction.save();

    return {
      message: 'Checkout initiated',
      checkoutUrl: this.paymobService.buildUnifiedCheckoutUrl(clientSecret),
      subscriptionId: subscription._id,
    };
  }

  // ─────────────────────── Webhook (idempotent) ───────────────────────

  async handleWebhook(body: any, hmac: string) {
    const txObj = body?.obj;
    if (!txObj) throw new BadRequestException('Invalid webhook payload');

    if (!this.paymobService.verifyHmac(txObj, hmac)) {
      this.logger.warn('Rejected Paymob webhook with invalid HMAC');
      throw new ForbiddenException('Invalid signature');
    }

    // ── Timestamp validation ─────────────────────────────────────────────
    const createdAtRaw = txObj.created_at;
    if (createdAtRaw) {
      const createdAtMs =
        typeof createdAtRaw === 'number'
          ? createdAtRaw * 1000          // Unix seconds → ms
          : new Date(createdAtRaw).getTime(); // ISO string fallback
      const ageMinutes = (Date.now() - createdAtMs) / 60_000;
      if (ageMinutes > 5) {
        this.logger.warn(
          `Rejected stale Paymob webhook (age: ${ageMinutes.toFixed(1)} min)`,
        );
        // Return 200 so Paymob does not keep retrying a legitimately old event.
        return { received: true };
      }
    }

    const specialReference =
      txObj.special_reference || txObj.order?.merchant_order_id;
    if (!specialReference) {
      this.logger.warn('Webhook missing special_reference; ignoring');
      return { received: true };
    }

    const transaction = await this.transactionModel
      .findById(specialReference)
      .catch(() => null);
    if (!transaction) {
      this.logger.warn(
        `No local transaction for reference ${specialReference}`,
      );
      return { received: true };
    }

    const incomingTxId = txObj.id?.toString();

    if (transaction.status === TransactionStatus.CANCELLED) {
      this.logger.warn(
        `Webhook received for CANCELLED transaction ${specialReference} — ignoring`,
      );
      return { received: true };
    }

    if (
      transaction.paymobTransactionId &&
      transaction.paymobTransactionId === incomingTxId
    ) {
      return { received: true }; // duplicate delivery — already processed
    }

    const success = txObj.success === true || txObj.success === 'true';
    transaction.status = success
      ? TransactionStatus.SUCCESS
      : TransactionStatus.FAILED;
    transaction.paymobTransactionId = incomingTxId;
    if (!success) {
      transaction.failureReason = txObj.data?.message || 'Payment declined';
    }

    try {
      await transaction.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        this.logger.warn(
          `Duplicate webhook delivery for paymobTransactionId ${incomingTxId} — ignoring`,
        );
        return { received: true };
      }
      throw err;
    }

    const subscription = await this.subscriptionModel.findById(
      transaction.subscriptionId,
    );
    if (!subscription) return { received: true };

    if (success) {
      const cardToken = this.paymobService.extractCardToken(txObj);
      const subType: string | undefined = txObj.source_data?.sub_type;
      subscription.paymentMethod = {
        type:
          subType === 'Wallet'
            ? 'wallet'
            : subType?.toLowerCase().includes('apple')
              ? 'apple_pay'
              : 'card',
        tokenEncrypted: cardToken
          ? encryptToken(cardToken)
          : subscription.paymentMethod?.tokenEncrypted,
        cardMask: txObj.source_data?.pan,
        cardType: subType,
      };
    }

    if (transaction.type === TransactionType.INITIAL) {
      if (success) {
        this.activatePeriod(
          subscription,
          subscription.planDurationDaysSnapshot,
        );
      } else {
        subscription.status = SubscriptionStatus.EXPIRED; // user must retry checkout
      }
    } else if (transaction.type === TransactionType.RENEWAL) {
      this.applyRenewalResult(subscription, success);
    }

    await subscription.save();
    return { received: true };
  }

  private activatePeriod(
    subscription: SubscriptionDocument,
    durationDays: number,
  ) {
    const now = new Date();
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = new Date(
      now.getTime() + durationDays * 86_400_000,
    );
    subscription.failedRenewalAttempts = 0;
    subscription.graceEndsAt = undefined;
    subscription.nextRetryAt = undefined;
  }

  /** Shared by both the sync MIT cron result and the async wallet-webhook result. */
  private applyRenewalResult(
    subscription: SubscriptionDocument,
    success: boolean,
  ) {
    if (success) {
      this.activatePeriod(subscription, subscription.planDurationDaysSnapshot);
      // TODO: hook EmailService here — "your subscription renewed" receipt
      return;
    }

    subscription.failedRenewalAttempts += 1;
    if (subscription.failedRenewalAttempts >= this.maxRenewalAttempts) {
      subscription.status = SubscriptionStatus.EXPIRED;
      subscription.autoRenew = false;
      subscription.graceEndsAt = undefined;
      subscription.nextRetryAt = undefined;
      // TODO: hook EmailService here — "subscription cancelled, payment failed"
    } else {
      subscription.status = SubscriptionStatus.PAST_DUE;
      const offsetDays =
        this.retryIntervalsDays[subscription.failedRenewalAttempts - 1] ?? 3;
      subscription.nextRetryAt = new Date(Date.now() + offsetDays * 86_400_000);
      if (!subscription.graceEndsAt) {
        subscription.graceEndsAt = new Date(
          Date.now() + this.gracePeriodDays * 86_400_000,
        );
      }
      // TODO: hook EmailService here — "payment failed, we'll retry"
    }
  }

  // ─────────────────────── Renewal execution (called by the cron) ───────────────────────

  async processRenewalCharge(subscription: SubscriptionDocument) {
    const paymentMethod = subscription.paymentMethod;

    // Wallets can't be silently charged — the customer must actively confirm.
    if (!paymentMethod?.tokenEncrypted || paymentMethod.type === 'wallet') {
      await this.sendManualRenewalLink(subscription);
      return;
    }

    const user = await this.usersService.findById(
      subscription.userId as Types.ObjectId,
    );
    if (!user) {
      this.logger.warn(`User not found for renewal: ${subscription.userId}`);
      return;
    }

    const transaction = await this.transactionModel.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      planId: subscription.planId,
      type: TransactionType.RENEWAL,
      amountCents: subscription.planTotalCentsSnapshot, // total incl. VAT
      currency: 'EGP',
      status: TransactionStatus.PENDING,
    });

    const cardToken = decryptToken(paymentMethod.tokenEncrypted);
    const result = await this.paymobService.chargeWithSavedToken({
      amountCents: subscription.planTotalCentsSnapshot, // total incl. VAT
      specialReference: transaction._id.toString(),
      cardToken,
      billing: this.buildBillingData(user),
      notificationUrl: `${this.apiBaseUrl}/subscriptions/webhook`,
    });

    transaction.status = result.success
      ? TransactionStatus.SUCCESS
      : TransactionStatus.FAILED;
    transaction.paymobTransactionId = result.transactionId;
    await transaction.save();

    this.applyRenewalResult(subscription, result.success);
    await subscription.save();
  }

  private async sendManualRenewalLink(subscription: SubscriptionDocument) {
    const user = await this.usersService.findById(
      subscription.userId as Types.ObjectId,
    );
    if (!user) return;

    const transaction = await this.transactionModel.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      planId: subscription.planId,
      type: TransactionType.RENEWAL,
      amountCents: subscription.planTotalCentsSnapshot, // total incl. VAT
      currency: 'EGP',
      status: TransactionStatus.PENDING,
    });

    const { clientSecret } = await this.paymobService.createIntention({
      amountCents: subscription.planTotalCentsSnapshot, // total incl. VAT
      specialReference: transaction._id.toString(),
      billing: this.buildBillingData(user),
      paymentMethods: this.paymobService.getWalletIntegrationIds(),
      notificationUrl: `${this.apiBaseUrl}/subscriptions/webhook`,
      redirectionUrl: `${this.frontendBaseUrl}/subscribe/result`,
    });

    const checkoutUrl =
      this.paymobService.buildUnifiedCheckoutUrl(clientSecret);

    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.failedRenewalAttempts += 1;
    if (!subscription.graceEndsAt) {
      subscription.graceEndsAt = new Date(
        Date.now() + this.gracePeriodDays * 86_400_000,
      );
    }
    subscription.nextRetryAt = undefined; // user-driven, not cron-retried
    await subscription.save();

    // TODO: hook EmailService here — send `checkoutUrl` to the user
    this.logger.log(
      `Manual wallet renewal link generated for user ${subscription.userId}: ${checkoutUrl}`,
    );
  }

  // ─────────────────────── User-facing ───────────────────────

  async cancelSubscription(userId: string) {
    const subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: {
        $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      },
    });
    if (!subscription) {
      throw new NotFoundException('No active subscription to cancel');
    }

    subscription.autoRenew = false;
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelledAt = new Date();
    await subscription.save();

    return {
      message:
        'Auto-renew turned off. You keep access until the end of the current period.',
      accessUntil: subscription.currentPeriodEnd,
    };
  }

  async reactivateSubscription(userId: string) {
    const subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: true,
    });
    if (!subscription) {
      throw new NotFoundException(
        'No cancelled subscription eligible for reactivation',
      );
    }
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= new Date()
    ) {
      throw new BadRequestException(
        'This period has already ended — please subscribe again',
      );
    }

    subscription.autoRenew = true;
    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = undefined;
    await subscription.save();
    return { message: 'Subscription reactivated', subscription };
  }

  async getMySubscription(userId: string) {
    const subscription = await this.subscriptionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    if (!subscription) {
      return {
        message: 'No subscription found',
        subscription: null,
        hasAccess: false,
      };
    }

    const hasAccess = await this.isUserSubscribed(userId);
    return {
      message: 'Subscription fetched successfully',
      subscription,
      hasAccess,
    };
  }

  // ─────────────────────── Content gating ───────────────────────

  // Check if user has an active or grace-period subscription.
  async isUserSubscribed(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: {
          $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
      })
      .sort({ currentPeriodEnd: -1 });
    if (!sub) return false;
    if (sub.status === SubscriptionStatus.ACTIVE) {
      return !sub.currentPeriodEnd || sub.currentPeriodEnd > new Date();
    }
    // PAST_DUE: access only within grace period
    return !!sub.graceEndsAt && sub.graceEndsAt > new Date();
  }

  // Check if user can access content based on release date and subscription status
  async canAccessContent(
    userId: string | undefined,
    releaseDate: Date | undefined,
  ): Promise<boolean> {
    if (!releaseDate) return this.isUserSubscribed(userId);
    const ageInDays =
      (Date.now() - new Date(releaseDate).getTime()) / 86_400_000;
    if (ageInDays >= this.freeAccessAfterDays) return true; // old enough → free
    return this.isUserSubscribed(userId); // new content → requires subscription
  }

  getFreeAccessAfterDays(): number {
    return this.freeAccessAfterDays;
  }

  // ─────────────────────── Admin ───────────────────────

  async findAllForAdmin(query: QuerySubscriptionDto) {
    const { userId, status, limit = 20, page = 1 } = query;
    const filter: Record<string, any> = {};
    if (userId) filter.userId = new Types.ObjectId(userId);
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      this.subscriptionModel
        .find(filter)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.subscriptionModel.countDocuments(filter),
    ]);

    return {
      message: 'Subscriptions fetched successfully',
      subscriptions: items,
      total,
      page,
      limit,
    };
  }

  async findOneForAdmin(id: string) {
    const subscription = await this.subscriptionModel
      .findById(id)
      .populate('userId', 'username email');
    if (!subscription) throw new NotFoundException('Subscription not found');
    return { message: 'Subscription fetched successfully', subscription };
  }

  async adminForceCancel(id: string) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) throw new NotFoundException('Subscription not found');
    subscription.status = SubscriptionStatus.EXPIRED;
    subscription.autoRenew = false;
    subscription.cancelledAt = new Date();
    await subscription.save();
    return { message: 'Subscription cancelled by admin', subscription };
  }

  async grantSubscription(dto: GrantSubscriptionDto, adminId: string) {
    const plan = await this.plansService.findByIdOrThrow(dto.planId);
    const user = await this.usersService.findById(
      new Types.ObjectId(dto.userId),
    );
    if (!user) throw new NotFoundException('User not found');

    // If user already has an active, past-due, or pending subscription,
    // expire it cleanly first to preserve its history, snapshot, and payment method,
    // while ensuring compliance with the unique active subscription DB index.
    const existingSubscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      status: {
        $in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PENDING,
        ],
      },
    });
    if (existingSubscription) {
      existingSubscription.status = SubscriptionStatus.EXPIRED;
      existingSubscription.autoRenew = false;
      existingSubscription.cancelledAt = new Date();
      await existingSubscription.save();
    }

    const subscription = new this.subscriptionModel({
      userId: new Types.ObjectId(dto.userId),
      planId: plan._id as Types.ObjectId,
      planCode: plan.code,
      planName: plan.name,
      planPriceCentsSnapshot: plan.priceCents,
      planVatPercentSnapshot: plan.vatPercent,
      planTotalCentsSnapshot: plan.totalCents,
      planDurationDaysSnapshot: plan.durationDays,
      autoRenew: false, // manual grants don't auto-charge
    });

    this.activatePeriod(subscription, plan.durationDays);
    await subscription.save();

    await this.transactionModel.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      planId: plan._id,
      type: TransactionType.MANUAL_GRANT,
      amountCents: 0,
      currency: plan.currency,
      status: TransactionStatus.SUCCESS,
    });

    this.logger.log(
      `Subscription manually granted to ${dto.userId} by admin ${adminId}${dto.reason ? ` (${dto.reason})` : ''}`,
    );
    return { message: 'Subscription granted successfully', subscription };
  }

  // ─────────────────────── Helpers ───────────────────────

  /** Exposed for the cron to query subscriptions directly. */
  getSubscriptionModel() {
    return this.subscriptionModel;
  }

  private buildBillingData(user: any) {
    const [firstName, ...rest] = (user.username || 'Orientation User').split(
      ' ',
    );
    return {
      first_name: firstName || 'Orientation',
      last_name: rest.join(' ') || 'User',
      email: user.email,
      phone_number: user.phoneNumber || 'NA',
      apartment: 'NA',
      floor: 'NA',
      street: 'NA',
      building: 'NA',
      city: 'Cairo',
      country: 'EG',
    };
  }
}
