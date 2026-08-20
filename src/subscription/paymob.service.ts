import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  shipping_method?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  state?: string;
}

export interface CreateSubscriptionPlanInput {
  name: string;
  amount_cents: number;
  frequency: number; // e.g., 7 or 30 days
  plan_type?: 'rent' | 'installment' | 'regular' | string;
  webhook_url?: string;
  reminder_days?: number | string;
  retrial_days?: number | string;
  number_of_deductions?: number | string;
  use_transaction_amount?: boolean;
  is_active?: boolean;
  integration?: number;
  fee?: number | string;
}

// Fixed field order required by Paymob for HMAC verification. Do not reorder.
const HMAC_FIELD_ORDER = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly integrationId: string;
  private readonly iframeId: string;
  private readonly hmacSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PAYMOB_BASE_URL') ||
      'https://accept.paymob.com/api';
    this.apiKey = this.getRequired('PAYMOB_API_KEY');
    this.integrationId = this.getRequired('PAYMOB_INTEGRATION_ID');
    this.iframeId = this.getRequired('PAYMOB_IFRAME_ID');
    this.hmacSecret = this.getRequired('PAYMOB_HMAC_SECRET');
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`${key} environment variable is required`);
    return value;
  }

  /**
   * Step 1: Obtain Authentication Token from Paymob
   */
  async authenticate(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey }),
    });
    if (!res.ok) {
      this.logger.error(`Paymob auth failed: ${res.status}`);
      throw new InternalServerErrorException(
        'Failed to authenticate with payment provider',
      );
    }
    const data = await res.json();
    return data.token;
  }

  /**
   * Standard Order Creation (E-commerce)
   */
  async createOrder(
    authToken: string,
    amountCents: number,
    merchantOrderId: string,
    currency = 'EGP',
  ): Promise<number> {
    const res = await fetch(`${this.baseUrl}/ecommerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency,
        merchant_order_id: merchantOrderId,
        items: [],
      }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      this.logger.error(
        `Paymob order creation failed (${res.status}): ${JSON.stringify(errorData)}`,
      );
      throw new InternalServerErrorException(
        errorData || 'Failed to create payment order',
      );
    }
    const data = await res.json();
    return data.id;
  }

  /**
   * Request Payment Key Token for Order
   */
  async getPaymentKey(
    authToken: string,
    orderId: number,
    amountCents: number,
    billingData: PaymobBillingData,
    currency = 'EGP',
  ): Promise<string> {
    const formattedBillingData = {
      apartment: billingData?.apartment || 'NA',
      email: billingData?.email || 'customer@example.com',
      floor: billingData?.floor || 'NA',
      first_name: billingData?.first_name || 'Customer',
      street: billingData?.street || 'NA',
      building: billingData?.building || 'NA',
      phone_number: billingData?.phone_number || '+201000000000',
      shipping_method: billingData?.shipping_method || 'NA',
      postal_code: billingData?.postal_code || 'NA',
      city: billingData?.city || 'NA',
      country: billingData?.country || 'EG',
      last_name: billingData?.last_name || 'NA',
      state: billingData?.state || 'NA',
    };

    const res = await fetch(`${this.baseUrl}/acceptance/payment_keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: orderId,
        billing_data: formattedBillingData,
        currency,
        integration_id: Number(this.integrationId),
      }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      this.logger.error(
        `Paymob payment key request failed (${res.status}): ${JSON.stringify(errorData)}`,
      );
      throw new InternalServerErrorException(
        errorData || 'Failed to initiate payment',
      );
    }
    const data = await res.json();
    return data.token;
  }

  /**
   * Subscription Plan: Create a new Subscription Plan in Paymob
   * Endpoint: POST /acceptance/subscription-plans
   * Requires Bearer token in Authorization header.
   */
  async createSubscriptionPlan(
    authToken: string,
    planData: CreateSubscriptionPlanInput,
  ): Promise<any> {
    const planType =
      !planData.plan_type || planData.plan_type === 'subscription'
        ? 'rent'
        : planData.plan_type;

    const payload: Record<string, any> = {
      frequency: Number(planData.frequency),
      name: planData.name,
      amount_cents: Number(planData.amount_cents),
      plan_type: planType,
      use_transaction_amount: planData.use_transaction_amount ?? true,
      is_active: planData.is_active ?? true,
      integration: planData.integration
        ? Number(planData.integration)
        : Number(this.integrationId),
    };

    if (planData.webhook_url !== undefined && planData.webhook_url !== null) {
      payload.webhook_url = planData.webhook_url;
    }

    if (
      planData.reminder_days !== undefined &&
      planData.reminder_days !== null &&
      planData.reminder_days !== ''
    ) {
      payload.reminder_days = Number(planData.reminder_days);
    }

    if (
      planData.retrial_days !== undefined &&
      planData.retrial_days !== null &&
      planData.retrial_days !== ''
    ) {
      payload.retrial_days = Number(planData.retrial_days);
    }

    if (
      planData.number_of_deductions !== undefined &&
      planData.number_of_deductions !== null &&
      planData.number_of_deductions !== ''
    ) {
      payload.number_of_deductions = Number(planData.number_of_deductions);
    }

    if (
      planData.fee !== undefined &&
      planData.fee !== null &&
      planData.fee !== '' &&
      planData.fee !== 0
    ) {
      payload.fee = Number(planData.fee);
    }

    const res = await fetch(`${this.baseUrl}/acceptance/subscription-plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      this.logger.error(
        `Paymob create subscription plan failed (${res.status}): ${JSON.stringify(errorData)}`,
      );
      throw new InternalServerErrorException(
        errorData || 'Failed to create subscription plan with payment provider',
      );
    }

    return await res.json();
  }

  /**
   * Subscription Plan: List all Subscription Plans from Paymob
   * Endpoint: GET /acceptance/subscription-plans
   */
  async listSubscriptionPlans(authToken: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/acceptance/subscription-plans`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      this.logger.error(`Paymob list subscription plans failed: ${res.status}`);
      throw new InternalServerErrorException(
        'Failed to fetch subscription plans from payment provider',
      );
    }

    return await res.json();
  }

  buildIframeUrl(paymentToken: string): string {
    return `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentToken}`;
  }

  /** Verifies the HMAC Paymob sends on the "transaction processed" callback. */
  verifyHmac(transaction: Record<string, any>, receivedHmac: string): boolean {
    if (!receivedHmac) return false;

    const concatenated = HMAC_FIELD_ORDER.map((field) =>
      this.getNestedValue(transaction, field),
    ).join('');

    const computed = crypto
      .createHmac('sha512', this.hmacSecret)
      .update(concatenated)
      .digest('hex');

    return (
      crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(receivedHmac.toLowerCase().padEnd(computed.length, '0')),
      ) && computed === receivedHmac.toLowerCase()
    );
  }

  private getNestedValue(obj: Record<string, any>, path: string): string {
    const value = path
      .split('.')
      .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
    return value === undefined || value === null ? '' : String(value);
  }
}