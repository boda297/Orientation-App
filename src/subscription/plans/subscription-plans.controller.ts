import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  // Find all active plans for users
  @Public()
  @Get()
  findActivePlans() {
    return this.plansService.findAllActivePlans();
  }

  // Find all plans
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findAllPlansForAdmin() {
    return this.plansService.findAllPlansForAdmin();
  }

  // Create a new plan
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.plansService.createPlan(createPlanDto);
  }

  // Update plan by id
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  updatePlan(@Param() params: MongoIdDto, @Body() updatePlanDto: UpdatePlanDto) {
    return this.plansService.updatePlan(params.id.toString(), updatePlanDto);
  }

  // Archived plan by id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  archivePlan(@Param() params: MongoIdDto) {
    return this.plansService.archivePlan(params.id.toString());
  }
}
