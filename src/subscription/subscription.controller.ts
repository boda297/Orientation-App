import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  CreateSubscriptionPlanInput,
  PaymobBillingData,
} from './paymob.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Post('paymob/plan')
  createPlan(@Body() planData: CreateSubscriptionPlanInput) {
    return this.subscriptionService.createPlan(planData);
  }

  @Public()
  @Get('paymob/plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Public()
  @Post('paymob/checkout')
  initiateCheckout(
    @Body()
    body: {
      amountCents: number;
      merchantOrderId?: string;
      billingData?: PaymobBillingData;
    },
  ) {
    return this.subscriptionService.initiateCheckout(
      body.amountCents,
      body.merchantOrderId,
      body.billingData,
    );
  }

  @Public()
  @Post('paymob/webhook')
  handleWebhook(@Body() payload: any, @Query('hmac') hmacQuery: string) {
    const isValid = this.subscriptionService.verifyWebhookHmac(
      payload,
      hmacQuery,
    );
    return { success: true, hmacValid: isValid };
  }

  @Post()
  create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionService.create(createSubscriptionDto);
  }

  @Get()
  findAll() {
    return this.subscriptionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscriptionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.update(+id, updateSubscriptionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subscriptionService.remove(+id);
  }
}
