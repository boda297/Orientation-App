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

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
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

  @Patch('cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.cancelSubscription(userId);
  }

  @Patch('reactivate')
  @UseGuards(JwtAuthGuard)
  reactivate(@CurrentUser('sub') userId: string) {
    return this.subscriptionsService.reactivateSubscription(userId);
  }

  // Paymob's server-to-server callback — intentionally unauthenticated.
  // Integrity comes solely from HMAC verification inside the service.
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  forceCancel(@Param() params: MongoIdDto) {
    return this.subscriptionsService.adminForceCancel(params.id.toString());
  }

  // Admin endpoint to grant a subscription to a user (e.g., for offline payment or testing).
  @Post('grant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  grant(
    @Body() dto: GrantSubscriptionDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.subscriptionsService.grantSubscription(dto, adminId);
  }
}
