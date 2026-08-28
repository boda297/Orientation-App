import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import { SubscriptionsService } from '../subscription.service';

@Injectable()
export class SubscriptionRenewalCron {
  private readonly logger = new Logger(SubscriptionRenewalCron.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_11AM)
  async run() {
    this.logger.log('Running subscription renewal cron');
    await this.expireCancelledPeriodsEnded();
    await this.expireGraceOverdue();
    await this.chargeDueRenewals();
    await this.retryPastDue();
  }

  /** Expire subscriptions that were cancelled and whose period has now ended. */
  private async expireCancelledPeriodsEnded() {
    const result = await this.subscriptionModel.updateMany(
      {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: false,
        currentPeriodEnd: { $lte: new Date() },
      },
      { $set: { status: SubscriptionStatus.EXPIRED } },
    );
    if (result.modifiedCount) {
      this.logger.log(
        `Expired ${result.modifiedCount} cancelled subscription(s) at period end`,
      );
    }
  }

  /** Expire past-due subscriptions whose grace period has elapsed. */
  private async expireGraceOverdue() {
    const result = await this.subscriptionModel.updateMany(
      {
        status: SubscriptionStatus.PAST_DUE,
        graceEndsAt: { $lte: new Date() },
      },
      { $set: { status: SubscriptionStatus.EXPIRED, autoRenew: false } },
    );
    if (result.modifiedCount) {
      this.logger.log(
        `Expired ${result.modifiedCount} subscription(s) past grace period`,
      );
    }
  }

  /** Charge active subscriptions whose period has ended and autoRenew is on. */
  private async chargeDueRenewals() {
    const due = await this.subscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      currentPeriodEnd: { $lte: new Date() },
    });
    for (const subscription of due) {
      await this.subscriptionsService
        .processRenewalCharge(subscription)
        .catch((err) =>
          this.logger.error(
            `Renewal charge failed for ${subscription._id}: ${err.message}`,
          ),
        );
    }
  }

  /** Retry past-due subscriptions whose nextRetryAt has arrived. */
  private async retryPastDue() {
    const retryDue = await this.subscriptionModel.find({
      status: SubscriptionStatus.PAST_DUE,
      autoRenew: true,
      nextRetryAt: { $lte: new Date() },
    });
    for (const subscription of retryDue) {
      await this.subscriptionsService
        .processRenewalCharge(subscription)
        .catch((err) =>
          this.logger.error(
            `Renewal retry failed for ${subscription._id}: ${err.message}`,
          ),
        );
    }
  }
}
