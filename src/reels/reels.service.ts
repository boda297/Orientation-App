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

  // Find all reels
  async findAllReels() {
    return this.reelModel
      .find()
      .select('title videoUrl thumbnail viewCount createdAt projectId')
      .sort({ createdAt: -1 });
  }

  // Find one reel by ID
  async findOneReel(id: Types.ObjectId) {
    const reel = await this.reelModel
      .findById(id)
      .populate('projectId', 'title slug');
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
