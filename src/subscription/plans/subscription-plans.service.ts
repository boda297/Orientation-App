import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../entities/subscription-plan.entity';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private planModel: Model<SubscriptionPlanDocument>,
  ) {}

  async createPlan(createPlanDto: CreatePlanDto) {
    // 1. Pre-validation checks for code and sortOrder
    const existingCode = await this.planModel.findOne({
      code: createPlanDto.code,
    });
    if (existingCode) {
      throw new BadRequestException('A plan with this code already exists');
    }

    const existingOrder = await this.planModel.findOne({
      sortOrder: createPlanDto.sortOrder,
    });
    if (existingOrder) {
      throw new BadRequestException(
        `A plan with sort order (${createPlanDto.sortOrder}) already exists`,
      );
    }

    try {
      const vatPercent = createPlanDto.vatPercent ?? 14;
      const vatCents = Math.round((createPlanDto.priceCents * vatPercent) / 100);
      const totalCents = createPlanDto.priceCents + vatCents;

      const plan = await this.planModel.create({
        ...createPlanDto,
        vatPercent,
        vatCents,
        totalCents,
      });
      return { message: 'Plan created successfully', plan };
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern?.sortOrder) {
          throw new BadRequestException('A plan with this sort order already exists');
        }
        throw new BadRequestException('A plan with this code already exists');
      }
      throw error;
    }
  }

  async updatePlan(id: string, updatePlanDto: UpdatePlanDto) {
    const existingPlan = await this.planModel.findById(id);
    if (!existingPlan) throw new NotFoundException('Plan not found');

    // Check code uniqueness if changing code
    if (updatePlanDto.code && updatePlanDto.code !== existingPlan.code) {
      const duplicateCode = await this.planModel.findOne({
        code: updatePlanDto.code,
        _id: { $ne: id },
      });
      if (duplicateCode) {
        throw new BadRequestException('A plan with this code already exists');
      }
    }

    // Check sortOrder uniqueness if changing sortOrder
    if (
      updatePlanDto.sortOrder !== undefined &&
      updatePlanDto.sortOrder !== existingPlan.sortOrder
    ) {
      const duplicateOrder = await this.planModel.findOne({
        sortOrder: updatePlanDto.sortOrder,
        _id: { $ne: id },
      });
      if (duplicateOrder) {
        throw new BadRequestException(
          `A plan with sort order (${updatePlanDto.sortOrder}) already exists`,
        );
      }
    }

    const priceCents = updatePlanDto.priceCents ?? existingPlan.priceCents;
    const vatPercent = updatePlanDto.vatPercent ?? existingPlan.vatPercent ?? 14;
    const vatCents = Math.round((priceCents * vatPercent) / 100);
    const totalCents = priceCents + vatCents;

    try {
      const plan = await this.planModel.findByIdAndUpdate(
        id,
        {
          ...updatePlanDto,
          vatPercent,
          vatCents,
          totalCents,
        },
        { new: true },
      );

      return { message: 'Plan updated successfully', plan };
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern?.sortOrder) {
          throw new BadRequestException('A plan with this sort order already exists');
        }
        throw new BadRequestException('A plan with this code already exists');
      }
      throw error;
    }
  }

  async archivePlan(id: string) {
    const plan = await this.planModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!plan) throw new NotFoundException('Plan not found');
    return { message: 'Plan archived successfully', plan };
  }

  async findAllActivePlans() {
    return this.planModel.find({ isActive: true }).sort({ sortOrder: 1 });
  }

  async findAllPlansForAdmin() {
    return this.planModel.find().sort({ sortOrder: 1 });
  }

  async findByIdOrThrow(id: string): Promise<SubscriptionPlanDocument> {
    const plan = await this.planModel.findById(id);
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plan not available');
    }
    return plan;
  }
}
