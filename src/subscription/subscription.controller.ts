import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscription.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { CustomThrottlerGuard } from 'src/common/guards/custom-throttler.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // strict: 5 req/min — payment initiation; repeated abuse would create
  // many stale Paymob intentions and inflate transaction records.
  @Post('checkout')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  checkout(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.subscriptionsService.initiateCheckout(userId, dto.planId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getMySubscription(userId);
  }

  // strict: 5 req/min — state-mutation; a legitimate user cancels once.
  @Patch('cancel')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  cancel(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.cancelSubscription(userId);
  }

  // strict: 5 req/min — state-mutation; a legitimate user reactivates once.
  @Patch('reactivate')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  reactivate(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.reactivateSubscription(userId);
  }

  @Public()
  @Post('webhook')
  @UseGuards(CustomThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ webhook: { limit: 20, ttl: 60_000 } })
  webhook(@Body() body: any, @Query('hmac') hmac: string) {
    return this.subscriptionsService.handleWebhook(body, hmac);
  }

  // ── Admin ──

  // Admin endpoint to get all subscriptions.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findAll(@Query() query: QuerySubscriptionDto) {
    return this.subscriptionsService.findAllForAdmin(query);
  }

  // Admin endpoint to get a subscription by ID.
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.subscriptionsService.findOneForAdmin(params.id.toString());
  }

  // Admin endpoint to force-cancel a subscription.
  @Patch(':id/force-cancel')
  @UseGuards(JwtAuthGuard, RolesGuard, CustomThrottlerGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  forceCancel(@Param() params: MongoIdDto) {
    return this.subscriptionsService.adminForceCancel(params.id.toString());
  }

  // Admin endpoint to grant a subscription to a user (e.g., for offline payment or testing).
  @Post('grant')
  @UseGuards(JwtAuthGuard, RolesGuard, CustomThrottlerGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  grant(
    @Body() dto: GrantSubscriptionDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.subscriptionsService.grantSubscription(dto, adminId);
  }
}

