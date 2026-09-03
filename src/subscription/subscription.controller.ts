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
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // strict: 5 req/min — payment initiation; repeated abuse would create
  // many stale Paymob intentions and inflate transaction records.
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  checkout(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.subscriptionsService.initiateCheckout(userId, dto.planId);
  }

  // default: 100 req/min — clients poll this to refresh subscription status.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.getMySubscription(userId);
  }

  // strict: 5 req/min — state-mutation; a legitimate user cancels once.
  @Patch('cancel')
  @UseGuards(JwtAuthGuard)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  cancel(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.cancelSubscription(userId);
  }

  // strict: 5 req/min — state-mutation; a legitimate user reactivates once.
  @Patch('reactivate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  reactivate(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.reactivateSubscription(userId);
  }

  // Paymob's server-to-server callback — intentionally unauthenticated.
  // Integrity comes solely from HMAC verification inside the service.
  // webhook: 20 req/min — tight enough to block automated probing while
  // allowing Paymob's legitimate retry schedule (3 retries over several minutes).
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ webhook: { limit: 20, ttl: 60_000 } })
  webhook(@Body() body: any, @Query('hmac') hmac: string) {
    return this.subscriptionsService.handleWebhook(body, hmac);
  }

  // ── Admin ──
  // Admin endpoints are already behind JWT + role guards. Read-only admin
  // queries may legitimately page through large datasets, so throttling is
  // skipped at the endpoint level — the global default still applies to
  // the IP but not per-authenticated-user key.

  // Admin endpoint to get all subscriptions.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @SkipThrottle()
  findAll(@Query() query: QuerySubscriptionDto) {
    return this.subscriptionsService.findAllForAdmin(query);
  }

  // Admin endpoint to get a subscription by ID.
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @SkipThrottle()
  findOne(@Param() params: MongoIdDto) {
    return this.subscriptionsService.findOneForAdmin(params.id.toString());
  }

  // Admin endpoint to force-cancel a subscription.
  @Patch(':id/force-cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  forceCancel(@Param() params: MongoIdDto) {
    return this.subscriptionsService.adminForceCancel(params.id.toString());
  }

  // Admin endpoint to grant a subscription to a user (e.g., for offline payment or testing).
  @Post('grant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  grant(
    @Body() dto: GrantSubscriptionDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.subscriptionsService.grantSubscription(dto, adminId);
  }
}

