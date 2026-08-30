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

    let subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: {
        $in: [
          SubscriptionStatus.PENDING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
        ],
      },
    });

    if (subscription && subscription.status !== SubscriptionStatus.PENDING) {
      throw new BadRequestException(
        'You already have an active subscription. Cancel it before subscribing to a different plan.',
      );
    }

    if (!subscription) {
      subscription = await this.subscriptionModel.create({
        userId: new Types.ObjectId(userId),
        planId: plan._id,
        planCode: plan.code,
        planName: plan.name,
        planPriceCentsSnapshot: plan.priceCents,
        planVatPercentSnapshot: plan.vatPercent,
        planTotalCentsSnapshot: plan.totalCents,
        planDurationDaysSnapshot: plan.durationDays,
        status: SubscriptionStatus.PENDING,
        autoRenew: true,
      });
    } else {
      // If user retried checkout with a different plan, update the snapshot
      subscription.planId = plan._id as Types.ObjectId;
      subscription.planCode = plan.code;
      subscription.planName = plan.name;
      subscription.planPriceCentsSnapshot = plan.priceCents;
      subscription.planVatPercentSnapshot = plan.vatPercent;
      subscription.planTotalCentsSnapshot = plan.totalCents;
      subscription.planDurationDaysSnapshot = plan.durationDays;
      await subscription.save();
    }

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

    // special_reference may arrive at top level or nested under `order` —
    // verify exact field name against your Paymob sandbox logs.
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
      this.logger.warn(`No local transaction for reference ${specialReference}`);
      return { received: true };
    }

    const incomingTxId = txObj.id?.toString();
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
    await transaction.save();

    const subscription = await this.subscriptionModel.findById(
      transaction.subscriptionId,
    );
    if (!subscription) return { received: true };

    if (success) {
      const cardToken = this.paymobService.extractCardToken(txObj);
      const subType: string | undefined = txObj.source_data?.sub_type;
      subscription.paymentMethod = {
        type: subType === 'Wallet'
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
        this.activatePeriod(subscription, subscription.planDurationDaysSnapshot);
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
      subscription.nextRetryAt = new Date(
        Date.now() + offsetDays * 86_400_000,
      );
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
      this.logger.warn(
        `User not found for renewal: ${subscription.userId}`,
      );
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

    const checkoutUrl = this.paymobService.buildUnifiedCheckoutUrl(clientSecret);

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
    return { message: 'Subscription fetched successfully', subscription, hasAccess };
  }

  // ─────────────────────── Content gating ───────────────────────

  /**
   * Returns true if the user has an active or grace-period subscription.
   * Used by Projects, Episodes, and Reels to gate premium content.
   */
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

  /**
   * Content is freely accessible to everyone if it is at least FREE_ACCESS_AFTER_DAYS
   * old (Story 1). Otherwise only subscribers can access it (Story 2).
   *
   * @param userId  - undefined means unauthenticated / not subscribed
   * @param releaseDate - the date the content was published/created
   */
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

    let subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      status: {
        $in: [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PENDING,
        ],
      },
    });
    if (!subscription) {
      subscription = new this.subscriptionModel({
        userId: new Types.ObjectId(dto.userId),
      });
    }

    subscription.planId = plan._id as Types.ObjectId;
    subscription.planCode = plan.code;
    subscription.planName = plan.name;
    subscription.planPriceCentsSnapshot = plan.priceCents;
    subscription.planVatPercentSnapshot = plan.vatPercent;
    subscription.planTotalCentsSnapshot = plan.totalCents;
    subscription.planDurationDaysSnapshot = plan.durationDays;
    subscription.autoRenew = false; // manual grants don't auto-charge
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
    const [firstName, ...rest] = (user.username || 'Orientation User').split(' ');
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
