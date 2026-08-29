import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { Episode, EpisodeDocument } from './entities/episode.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from 'src/projects/projects.service';
import { S3Service } from 'src/s3/s3.service';
import { SubscriptionsService } from 'src/subscription/subscription.service';

@Injectable()
export class EpisodeService {
  private readonly logger = new Logger(EpisodeService.name);

  constructor(
    @InjectModel(Episode.name) private episodeModel: Model<EpisodeDocument>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly s3Service: S3Service,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /*
  =========================================  
        Core CRUD & Route Functions
  =========================================  
  */

  // Upload a new episode
  async uploadEpisode(
    createEpisodeDto: CreateEpisodeDto,
    episodeFile: Express.Multer.File,
    thumbnailFile?: Express.Multer.File,
    uploadedBy?: string,
  ) {
    const project = await this.projectsService.findProjectById(
      createEpisodeDto.projectId,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Upload episode video to S3
    const { key, url } = await this.s3Service.uploadFile(
      episodeFile,
      'episodes',
    );

    // Upload thumbnail to S3 if provided
    let thumbnailUrl: string | undefined;
    if (thumbnailFile) {
      const { url: thumbUrl } = await this.s3Service.uploadFile(
        thumbnailFile,
        'images',
      );
      thumbnailUrl = thumbUrl;
    }

    // Create episode with the uploaded S3 URLs
    const episodeData: any = {
      projectId: createEpisodeDto.projectId,
      title: createEpisodeDto.title,
      thumbnail: thumbnailUrl,
      episodeUrl: url,
      episodeOrder: createEpisodeDto.episodeOrder,
      s3Key: key,
      duration: createEpisodeDto.duration,
    };

    const episode = new this.episodeModel(episodeData);
    const savedEpisode = await episode.save();

    // Push episode to project's episodes array via ProjectsService
    await this.projectsService.addEpisodeToProject(
      createEpisodeDto.projectId,
      savedEpisode._id,
    );

    return {
      message: 'Episode uploaded successfully',
      episode: savedEpisode,
    };
  }

  // Find all episodes
  async findAll() {
    return this.episodeModel
      .find()
      .populate('projectId', 'title slug')
      .sort({ createdAt: -1 });
  }

  // Find one episode by ID
  async findOne(id: Types.ObjectId, userId?: string) {
    const episode = await this.episodeModel
      .findById(id)
      .populate('projectId', 'title slug');

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    // Content gating: free after FREE_ACCESS_AFTER_DAYS from createdAt
    const createdAt = (episode as any).createdAt as Date | undefined;
    const hasAccess = await this.subscriptionsService.canAccessContent(
      userId,
      createdAt,
    );

    return { ...episode.toObject(), hasAccess };
  }

  // Update episode details and replace files on S3 if provided
  async update(
    id: Types.ObjectId,
    updateEpisodeDto: UpdateEpisodeDto,
    episodeFile?: Express.Multer.File,
    thumbnailFile?: Express.Multer.File,
  ) {
    const episode = await this.episodeModel.findById(id);

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    let episodeUrl = episode.episodeUrl;
    let thumbnailUrl = episode.thumbnail;
    let s3Key = episode.s3Key;

    // If new episode file is provided, upload it and delete old one
    if (episodeFile) {
      const { key, url } = await this.s3Service.uploadFile(
        episodeFile,
        'episodes',
      );
      episodeUrl = url;

      // Delete old episode from S3
      if (episode.s3Key) {
        await this.s3Service.deleteFile(episode.s3Key);
        this.logger.log(`Deleted old episode file from S3: ${episode.s3Key}`);
      }

      s3Key = key;
    }

    // If new thumbnail is provided, upload it and delete old one
    if (thumbnailFile) {
      const { url: thumbUrl } = await this.s3Service.uploadFile(
        thumbnailFile,
        'images',
      );

      // Delete old thumbnail from S3 if it exists
      if (episode.thumbnail) {
        const oldThumbnailKey = episode.thumbnail
          .split('/')
          .slice(-2)
          .join('/');
        if (oldThumbnailKey.startsWith('images/')) {
          await this.s3Service.deleteFile(oldThumbnailKey);
          this.logger.log(`Deleted old thumbnail from S3: ${oldThumbnailKey}`);
        }
      }

      thumbnailUrl = thumbUrl;
    }

    // Update episode with new data
    const updatedEpisode = await this.episodeModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...updateEpisodeDto,
            episodeUrl,
            thumbnail: thumbnailUrl,
            s3Key,
          },
        },
        { new: true },
      )
      .populate('projectId', 'title slug');

    this.logger.log(`Episode updated: ${id}`);
    return {
      message: 'Episode updated successfully',
      episode: updatedEpisode,
    };
  }

  // Remove single episode
  async remove(id: Types.ObjectId) {
    const episode = await this.episodeModel.findById(id);

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    // Delete file from S3
    if (episode.s3Key) {
      await this.s3Service.deleteFile(episode.s3Key);
    }

    // Remove episode from project's episodes array via ProjectsService
    await this.projectsService.removeEpisodeFromProject(
      episode.projectId,
      id,
    );

    await this.episodeModel.findByIdAndDelete(id);

    this.logger.log(`Episode deleted: ${id}`);
    return {
      message: 'Episode deleted successfully',
    };
  }

  /*
  =========================================  
              Helper Functions
  =========================================  
  */

  // Cascade delete multiple episodes by IDs (used by ProjectsService and DeveloperService)
  async deleteManyByIds(episodeIds: Types.ObjectId[]) {
    if (!episodeIds || episodeIds.length === 0) return;
    const episodes = await this.episodeModel.find({
      _id: { $in: episodeIds },
    });
    for (const episode of episodes) {
      if (episode.s3Key) {
        try {
          await this.s3Service.deleteFile(episode.s3Key);
        } catch (error) {
          this.logger.error(
            `Failed to delete episode S3 file: ${episode.s3Key}`,
            error,
          );
        }
      }
    }
    await this.episodeModel.deleteMany({
      _id: { $in: episodeIds },
    });
  }
}
