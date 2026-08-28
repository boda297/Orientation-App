import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './entities/subscription-plan.entity';
import {
  Subscription,
  SubscriptionSchema,
} from './entities/subscription.entity';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './entities/payment-transaction.entity';
import { SubscriptionPlansService } from './plans/subscription-plans.service';
import { SubscriptionsService } from './subscription.service';
import { SubscriptionPlansController } from './plans/subscription-plans.controller';
import { SubscriptionsController } from './subscription.controller';
import { PaymobService } from './integrations/paymob.service';
import { SubscriptionRenewalCron } from './jobs/subscription-renewal.cron';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
    UsersModule,
  ],
  controllers: [SubscriptionPlansController, SubscriptionsController],
  providers: [
    SubscriptionPlansService,
    SubscriptionsService,
    PaymobService,
    SubscriptionRenewalCron,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionModule {}
