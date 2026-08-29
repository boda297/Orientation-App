import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Developer, DeveloperDoc } from '../entities/developer.entity';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import { Reel, ReelDocument } from 'src/reels/entities/reel.entity';
import {
  Inventory,
  InventoryDocument,
} from 'src/files/entities/inventory.entity';
import { Role } from 'src/auth/enum/roles.enum';
import { AuthJwtPayload } from 'src/auth/types/auth-jwtPayload';

@Injectable()
export class DeveloperOwnershipService {
  constructor(
    @InjectModel(Developer.name)
    private readonly developerModel: Model<DeveloperDoc>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Reel.name)
    private readonly reelModel: Model<ReelDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  /**
   * Resolves the linked Developer record for a given user ID.
   */
  async getDeveloperByUserId(
    userId: string | Types.ObjectId,
  ): Promise<DeveloperDoc | null> {
    const objectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.developerModel
      .findOne({ userId: objectId, deletedAt: null })
      .exec();
  }

  /**
   * Verifies if a user owns a resource by developer ID.
   * Admins and Superadmins bypass ownership checks.
   */
  async verifyDeveloperOwnership(
    user: AuthJwtPayload,
    targetDeveloperId: string | Types.ObjectId,
  ): Promise<DeveloperDoc> {
    const targetObjectId =
      typeof targetDeveloperId === 'string'
        ? new Types.ObjectId(targetDeveloperId)
        : targetDeveloperId;

    // Admin / Superadmin bypass
    if (user.role === Role.SUPERADMIN || user.role === Role.ADMIN) {
      const targetDev = await this.developerModel
        .findById(targetObjectId)
        .exec();
      if (!targetDev) {
        throw new NotFoundException('Developer profile not found');
      }
      return targetDev;
    }

    if (user.role !== Role.DEVELOPER) {
      throw new ForbiddenException(
        'Only developer accounts can perform this action',
      );
    }

    const dev = await this.getDeveloperByUserId(user.sub);
    if (!dev) {
      throw new ForbiddenException(
        'User account is not linked to an active Developer profile',
      );
    }

    if (!dev._id.equals(targetObjectId)) {
      throw new ForbiddenException(
        'You do not have permission to access or modify resources belonging to another developer',
      );
    }

    return dev;
  }

  /**
   * Verifies if the current user owns a project resource by project ID.
   */
  async verifyProjectOwnership(
    user: AuthJwtPayload,
    projectId: string | Types.ObjectId,
  ): Promise<{ developer: DeveloperDoc; project: ProjectDocument }> {
    const projectObjectId =
      typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
    const project = await this.projectModel.findById(projectObjectId).exec();
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const developer = await this.verifyDeveloperOwnership(
      user,
      project.developer,
    );
    return { developer, project };
  }

  /**
   * Verifies if the current user owns a reel resource by reel ID.
   */
  async verifyReelOwnership(
    user: AuthJwtPayload,
    reelId: string | Types.ObjectId,
  ): Promise<{ developer: DeveloperDoc; reel: ReelDocument }> {
    const reelObjectId =
      typeof reelId === 'string' ? new Types.ObjectId(reelId) : reelId;
    const reel = await this.reelModel.findById(reelObjectId).exec();
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }

    const developer = await this.verifyDeveloperOwnership(
      user,
      reel.developerId,
    );
    return { developer, reel };
  }

  /**
   * Verifies if the current user owns an inventory resource by inventory ID.
   */
  async verifyInventoryOwnership(
    user: AuthJwtPayload,
    inventoryId: string | Types.ObjectId,
  ): Promise<{ developer: DeveloperDoc; inventory: InventoryDocument }> {
    const invObjectId =
      typeof inventoryId === 'string'
        ? new Types.ObjectId(inventoryId)
        : inventoryId;
    const inventory = await this.inventoryModel.findById(invObjectId).exec();
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    const developer = await this.verifyDeveloperOwnership(
      user,
      inventory.developer,
    );
    return { developer, inventory };
  }
}
