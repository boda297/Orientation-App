import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateReelDto } from './dto/create-reel.dto';
import { UpdateReelDto } from './dto/update-reel.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reel, ReelDocument } from './entities/reel.entity';
import { Model, Types } from 'mongoose';
import { S3Service } from 'src/s3/s3.service';
import { ProjectsService } from 'src/projects/projects.service';
import { DeveloperService } from 'src/developer/developer.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ReelsService {
  constructor(
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly developerService: DeveloperService,
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  /*
  =========================================  
        Core CRUD & Route Functions
  =========================================  
  */

  // Upload a new reel
  async uploadReel(
    createReelDto: CreateReelDto,
    file: Express.Multer.File,
    thumbnail: Express.Multer.File,
  ) {
    const project = await this.projectsService.findProjectById(
      createReelDto.projectId,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const developer = await this.developerService.findOneDeveloper(
      project.developer,
    );
    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    // Upload reel to S3
    const { key, url } = await this.s3Service.uploadFile(file, 'reels');

    // Upload thumbnail to S3
    const { url: thumbnailUrl } = await this.s3Service.uploadFile(
      thumbnail,
      'images',
    );

    // Create reel
    const reel = new this.reelModel({
      title: createReelDto.title,
      videoUrl: url,
      thumbnail: thumbnailUrl,
      projectId: createReelDto.projectId,
      developerId: developer._id,
      s3Key: key,
    });
    const savedReel = await reel.save();

    // Push reel to project's reels array via ProjectsService
    await this.projectsService.addReelToProject(
      createReelDto.projectId,
      savedReel._id,
    );

    return {
      message: 'Reel uploaded successfully',
      reel: savedReel,
    };
  }

  // Find all reels (TikTok FYP Recommendation Feed Algorithm)
  async findAllReels(options?: {
    page?: number;
    limit?: number;
    userId?: Types.ObjectId | string;
  }) {
    // 1. Fetch candidate reels with necessary fields for scoring & response
    const reels = await this.reelModel
      .find()
      .select(
        'title videoUrl thumbnail viewCount saveCount createdAt projectId developerId',
      )
      .populate('projectId', 'title logoUrl whatsappNumber')
      .lean();

    if (!reels || reels.length === 0) {
      return [];
    }

    const now = Date.now();

    // Retrieve saved reels set for personalization if user is logged in
    let savedReelIdsSet: Set<string> | undefined;
    if (options?.userId && Types.ObjectId.isValid(options.userId)) {
      try {
        const userObjId = new Types.ObjectId(options.userId);
        const savedIds = await this.usersService.getSavedReelIds(userObjId);
        savedReelIdsSet = new Set(savedIds.map((id) => id.toString()));
      } catch {
        // Fallback: ignore personalization if user not found
      }
    }

    // 2. Score each reel and assign a Weighted Random Sampling rankKey (Efraimidis & Spirakis)
    const scoredReels = reels.map((reel) => {
      const score = this.calculateReelScore(reel, now, savedReelIdsSet);
      // Square root scaling compresses extreme outliers while maintaining high-score priority
      const weight = Math.pow(Math.max(score, 0.1), 0.5);
      // rankKey = u^(1 / weight), where u ~ Uniform(0, 1)
      const u = Math.max(Math.random(), 0.00001);
      const rankKey = Math.pow(u, 1 / weight);
      return { reel, rankKey };
    });

    // 3. Sort descending by rankKey (stochastic priority order)
    scoredReels.sort((a, b) => b.rankKey - a.rankKey);

    let rankedReels = scoredReels.map((item) => item.reel);

    // 4. Anti-clustering diversity filter (avoid consecutive reels from same project)
    rankedReels = this.applyDiversityFilter(rankedReels);

    // 5. Pagination if requested
    if (options?.limit && options.limit > 0) {
      const page = Math.max(1, options.page || 1);
      const limit = options.limit;
      const start = (page - 1) * limit;
      rankedReels = rankedReels.slice(start, start + limit);
    }

    // 6. Return formatted reels with exact requested fields
    return rankedReels.map((reel: any) => ({
      _id: reel._id,
      title: reel.title,
      videoUrl: reel.videoUrl,
      thumbnail: reel.thumbnail,
      viewCount: reel.viewCount ?? 0,
      createdAt: reel.createdAt,
      developerId: reel.developerId,
      projectId: reel.projectId,
    }));
  }

  /**
   * Calculates dynamic recommendation score for a reel (TikTok FYP style)
   */
  private calculateReelScore(
    reel: any,
    now: number,
    savedReelIdsSet?: Set<string>,
  ): number {
    const views = reel.viewCount || 0;
    const saves = reel.saveCount || 0;

    // 1. Base engagement score (saves weighted higher as strong intentional interest)
    const baseEngagement = views * 1 + saves * 5;

    // 2. Freshness & Recency time decay
    const createdAt = reel.createdAt
      ? new Date(reel.createdAt).getTime()
      : reel._id?.getTimestamp
        ? reel._id.getTimestamp().getTime()
        : now;

    const hoursSinceCreation = Math.max(0, (now - createdAt) / (1000 * 60 * 60));

    // Exploration bonus for fresh content (TikTok test bucket)
    let freshnessBonus = 0;
    if (hoursSinceCreation <= 24) {
      freshnessBonus = 25;
    } else if (hoursSinceCreation <= 72) {
      freshnessBonus = 12;
    } else if (hoursSinceCreation <= 168) {
      // within 7 days
      freshnessBonus = 5;
    }

    // Time decay: smooth power decay so older content gradually yields to newer content
    const timeDecay = Math.pow(1 + hoursSinceCreation / 48, 1.25);
    let score = (baseEngagement + freshnessBonus + 5) / timeDecay;

    // 3. User personalization (if user is authenticated)
    if (savedReelIdsSet && reel._id) {
      const reelIdStr = reel._id.toString();
      if (savedReelIdsSet.has(reelIdStr)) {
        // Already saved: slight penalty to prioritize discovering unseen content
        score *= 0.8;
      }
    }

    return Math.max(score, 0.1);
  }

  /**
   * Ensures no two consecutive reels belong to the same project (Anti-Clustering)
   */
  private applyDiversityFilter(reels: any[]): any[] {
    if (reels.length <= 2) return reels;

    const result = [...reels];
    for (let i = 1; i < result.length - 1; i++) {
      const currentProjId = this.extractProjectId(result[i]);
      const prevProjId = this.extractProjectId(result[i - 1]);

      if (currentProjId && prevProjId && currentProjId === prevProjId) {
        // Look ahead up to 3 items for a reel from a different project to swap with
        for (let j = i + 1; j < Math.min(i + 4, result.length); j++) {
          const candidateProjId = this.extractProjectId(result[j]);
          if (candidateProjId && candidateProjId !== prevProjId) {
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
            break;
          }
        }
      }
    }
    return result;
  }

  private extractProjectId(reel: any): string | null {
    if (!reel?.projectId) return null;
    if (typeof reel.projectId === 'string') return reel.projectId;
    if (reel.projectId._id) return reel.projectId._id.toString();
    return reel.projectId.toString();
  }

  // Find one reel by ID
  async findOneReel(id: Types.ObjectId) {
    const reel = await this.reelModel
      .findById(id)
      .populate('projectId', 'title logoUrl whatsappNumber');
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }
    await this.incrementViewCount(id);

    return {
      message: 'Reel fetched successfully',
      reel,
    };
  }

  // Update reel details and replace files on S3 if provided
  async updateReel(
    id: Types.ObjectId,
    updateReelDto: UpdateReelDto,
    file?: Express.Multer.File,
    thumbnail?: Express.Multer.File,
  ) {
    const reel = await this.reelModel.findById(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }

    let videoUrl = reel.videoUrl;
    let thumbnailUrl = reel.thumbnail;
    let s3Key = reel.s3Key;

    // If new video file is provided, upload it and delete old one
    if (file) {
      const { key, url } = await this.s3Service.uploadFile(file, 'reels');
      videoUrl = url;
      s3Key = key;

      // Delete old video from S3
      if (reel.s3Key) {
        await this.s3Service.deleteFile(reel.s3Key);
      }
    }

    // If new thumbnail is provided, upload it and delete old one
    if (thumbnail) {
      const { url: thumbUrl } = await this.s3Service.uploadFile(
        thumbnail,
        'images',
      );
      thumbnailUrl = thumbUrl;

      // Delete old thumbnail from S3
      if (reel.thumbnail) {
        await this.s3Service.deleteFile(reel.thumbnail);
      }
    }

    // Update reel with new data
    const updatedReel = await this.reelModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...updateReelDto,
          videoUrl,
          thumbnail: thumbnailUrl,
          s3Key,
        },
      },
      { new: true },
    );

    return {
      message: 'Reel updated successfully',
      reel: updatedReel,
    };
  }

  // Remove single reel
  async removeReel(id: Types.ObjectId) {
    const reel = await this.reelModel.findByIdAndDelete(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }

    // Pull reel from project's reels array via ProjectsService
    await this.projectsService.removeReelFromProject(
      reel.projectId,
      reel._id,
    );

    // Delete reel from S3
    await this.s3Service.deleteFile(reel.s3Key);
    // Delete thumbnail from S3
    await this.s3Service.deleteFile(reel.thumbnail || '');

    return {
      message: 'Reel deleted successfully',
    };
  }

  // Save reel for user
  async saveReel(id: Types.ObjectId, userId: Types.ObjectId) {
    const reel = await this.reelModel.findById(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }

    const result = await this.usersService.addSavedReel(userId, id);
    if (result.alreadySaved) {
      return { message: 'Reel already saved' };
    }

    await this.reelModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: 1 } },
      { new: true },
    );

    return { message: 'Reel saved successfully' };
  }

  // Unsave reel for user
  async unsaveReel(id: Types.ObjectId, userId: Types.ObjectId) {
    const reel = await this.reelModel.findById(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }

    await this.usersService.removeSavedReel(userId, id);

    await this.reelModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: -1 } },
      { new: true },
    );

    return { message: 'Reel unsaved successfully' };
  }

  // Get all saved reels for user
  async getSavedReelsByUser(userId: Types.ObjectId) {
    const savedReelIds = await this.usersService.getSavedReelIds(userId);
    const reels = await this.reelModel
      .find({ _id: { $in: savedReelIds } })
      .select('id title thumbnail');

    return {
      message: 'Saved reels fetched successfully',
      reels,
    };
  }

  /*
  =========================================  
              Helper Functions
  =========================================  
  */

  // Increment view count for a reel
  async incrementViewCount(id: Types.ObjectId) {
    const reel = await this.reelModel.findByIdAndUpdate(id, {
      $inc: { viewCount: 1 },
    });
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }
    return {
      message: 'View count incremented successfully',
    };
  }

  // Cascade delete multiple reels by IDs (used by ProjectsService and DeveloperService)
  async deleteManyByIds(reelIds: Types.ObjectId[]) {
    if (!reelIds || reelIds.length === 0) return;
    const reels = await this.reelModel.find({
      _id: { $in: reelIds },
    });
    for (const reel of reels) {
      if (reel.s3Key) {
        try {
          await this.s3Service.deleteFile(reel.s3Key);
        } catch (error) {
          console.error(`Failed to delete reel S3 file: ${reel.s3Key}`, error);
        }
      }
      if (reel.thumbnail) {
        try {
          await this.s3Service.deleteFile(reel.thumbnail);
        } catch (error) {
          console.error(
            `Failed to delete reel thumbnail S3 file: ${reel.thumbnail}`,
            error,
          );
        }
      }
    }
    await this.reelModel.deleteMany({
      _id: { $in: reelIds },
    });
  }
}
