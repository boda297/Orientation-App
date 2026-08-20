import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PaymobService } from './paymob.service';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PaymobService],
  exports: [SubscriptionService, PaymobService],
})
export class SubscriptionModule {}
