import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface BillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment: string;
  floor: string;
  street: string;
  building: string;
  city: string;
  country: string;
}

// Fixed field order required by Paymob for HMAC verification on the
// "transaction processed" callback — do not reorder.
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
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly hmacSecret: string;
  private readonly cardIntegrationId: string;
  private readonly walletIntegrationId?: string;
  private readonly applePayIntegrationId?: string;
  private readonly motoIntegrationId?: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PAYMOB_BASE_URL') ||
      'https://accept.paymob.com';
    this.secretKey = this.getRequired('PAYMOB_SECRET_KEY');
    this.publicKey = this.getRequired('PAYMOB_PUBLIC_KEY');
    this.hmacSecret = this.getRequired('PAYMOB_HMAC_SECRET');
    this.cardIntegrationId = this.getRequired('PAYMOB_CARD_INTEGRATION_ID');
    this.walletIntegrationId = this.configService.get<string>(
      'PAYMOB_WALLET_INTEGRATION_ID',
    );
    this.applePayIntegrationId = this.configService.get<string>(
      'PAYMOB_APPLE_PAY_INTEGRATION_ID',
    );
    this.motoIntegrationId = this.configService.get<string>(
      'PAYMOB_MOTO_INTEGRATION_ID',
    );
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`${key} environment variable is required`);
    return value;
  }

  getCustomerPaymentMethodIds(): (number | string)[] {
    return [
      this.cardIntegrationId,
      this.walletIntegrationId,
      this.applePayIntegrationId,
    ]
      .filter(Boolean)
      .map((id) => (isNaN(Number(id)) ? id! : Number(id)));
  }

  getWalletIntegrationIds(): (number | string)[] {
    return [this.walletIntegrationId]
      .filter(Boolean)
      .map((id) => (isNaN(Number(id)) ? id! : Number(id)));
  }

  getApplePayIntegrationIds(): (number | string)[] {
    return [this.applePayIntegrationId]
      .filter(Boolean)
      .map((id) => (isNaN(Number(id)) ? id! : Number(id)));
  }

  async createIntention(params: {
    amountCents: number;
    currency?: string;
    specialReference: string;
    billing: BillingData;
    paymentMethods: (number | string)[];
    notificationUrl: string;
    redirectionUrl: string;
    extras?: Record<string, any>;
  }): Promise<{ clientSecret: string; intentionId: string }> {
    const res = await fetch(`${this.baseUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.secretKey}`,
      },
      body: JSON.stringify({
        amount: params.amountCents,
        currency: params.currency || 'EGP',
        payment_methods: params.paymentMethods,
        items: [],
        billing_data: params.billing,
        special_reference: params.specialReference,
        notification_url: params.notificationUrl,
        redirection_url: params.redirectionUrl,
        extras: params.extras || {},
      }),
    });

    if (!res.ok) {
      this.logger.error(
        `Paymob intention creation failed: ${res.status} ${await res.text()}`,
      );
      throw new InternalServerErrorException(
        'Failed to create payment intention',
      );
    }

    const data = await res.json();
    return {
      clientSecret: data.client_secret,
      intentionId: data.id?.toString(),
    };
  }

  buildUnifiedCheckoutUrl(clientSecret: string): string {
    return `${this.baseUrl}/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${clientSecret}`;
  }

  /**
   * Charges a previously saved card token with no customer interaction (MIT).
   * VERIFY IN SANDBOX: Paymob's public docs don't fully specify the confirm
   * payload shape for token-based MIT under the Intentions API. Confirm the
   * exact contract against Paymob's current Postman collection / support
   * before relying on this in production.
   */
  async chargeWithSavedToken(params: {
    amountCents: number;
    currency?: string;
    specialReference: string;
    cardToken: string;
    billing: BillingData;
    notificationUrl: string;
  }): Promise<{ success: boolean; transactionId?: string; raw: any }> {
    if (!this.motoIntegrationId) {
      throw new InternalServerErrorException(
        'MOTO integration is not configured for automatic renewals',
      );
    }

    const { clientSecret } = await this.createIntention({
      amountCents: params.amountCents,
      currency: params.currency,
      specialReference: params.specialReference,
      billing: params.billing,
      paymentMethods: [this.motoIntegrationId],
      notificationUrl: params.notificationUrl,
      redirectionUrl: params.notificationUrl,
      extras: { is_renewal: true },
    });

    const res = await fetch(`${this.baseUrl}/v1/intentions/confirm/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.secretKey}`,
      },
      body: JSON.stringify({
        client_secret: clientSecret,
        payment_method: this.motoIntegrationId,
        payload: { token: params.cardToken },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(
        `MIT charge failed for reference ${params.specialReference}: ${res.status}`,
      );
      return { success: false, raw: data };
    }

    return {
      success: data.success === true,
      transactionId: data.id?.toString(),
      raw: data,
    };
  }

  verifyHmac(transaction: Record<string, any>, receivedHmac: string): boolean {
    if (!receivedHmac) return false;

    const concatenated = HMAC_FIELD_ORDER.map((field) =>
      this.getNestedValue(transaction, field),
    ).join('');
    const computed = crypto
      .createHmac('sha512', this.hmacSecret)
      .update(concatenated)
      .digest('hex');

    return computed === receivedHmac.toLowerCase();
  }

  /** Pulls the saved-card token out of a successful transaction webhook, if present. */
  extractCardToken(transactionObj: Record<string, any>): string | undefined {
    return (
      transactionObj.token ||
      transactionObj.card_token ||
      transactionObj?.source_data?.token
    );
  }

  private getNestedValue(obj: Record<string, any>, path: string): string {
    const value = path
      .split('.')
      .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
    return value === undefined || value === null ? '' : String(value);
  }
}
