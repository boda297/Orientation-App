import { Injectable } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  PaymobService,
  CreateSubscriptionPlanInput,
  PaymobBillingData,
} from './paymob.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly paymobService: PaymobService) {}

  async createPlan(planData: CreateSubscriptionPlanInput) {
    const token = await this.paymobService.authenticate();
    return this.paymobService.createSubscriptionPlan(token, planData);
  }

  async getPlans() {
    const token = await this.paymobService.authenticate();
    return this.paymobService.listSubscriptionPlans(token);
  }

  async initiateCheckout(
    amountCents: number,
    merchantOrderId?: string,
    billingData?: PaymobBillingData,
  ) {
    // Generate a unique order ID for each request to avoid Paymob 422 duplicate error
    const uniqueMerchantOrderId = merchantOrderId
      ? `${merchantOrderId}-${Date.now()}`
      : `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const authToken = await this.paymobService.authenticate();
    const orderId = await this.paymobService.createOrder(
      authToken,
      amountCents,
      uniqueMerchantOrderId,
    );
    const paymentToken = await this.paymobService.getPaymentKey(
      authToken,
      orderId,
      amountCents,
      billingData || ({} as PaymobBillingData),
    );
    const iframeUrl = this.paymobService.buildIframeUrl(paymentToken);

    return {
      orderId,
      merchantOrderId: uniqueMerchantOrderId,
      paymentToken,
      iframeUrl,
    };
  }

  verifyWebhookHmac(payload: Record<string, any>, hmacHeader: string) {
    return this.paymobService.verifyHmac(payload, hmacHeader);
  }

  create(createSubscriptionDto: CreateSubscriptionDto) {
    return 'This action adds a new subscription';
  }

  findAll() {
    return `This action returns all subscription`;
  }

  findOne(id: number) {
    return `This action returns a #${id} subscription`;
  }

  update(id: number, updateSubscriptionDto: UpdateSubscriptionDto) {
    return `This action updates a #${id} subscription`;
  }

  remove(id: number) {
    return `This action removes a #${id} subscription`;
  }
}
