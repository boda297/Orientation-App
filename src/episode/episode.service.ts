import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { Episode, EpisodeDocument } from './entities/episode.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import { S3Service } from 'src/s3/s3.service';

@Injectable()
export class EpisodeService {
  private readonly logger = new Logger(EpisodeService.name);

  constructor(
    @InjectModel(Episode.name) private episodeModel: Model<EpisodeDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private s3Service: S3Service,
  ) {}

  async uploadEpisode(
    createEpisodeDto: CreateEpisodeDto,
    episodeFile: Express.Multer.File,
    thumbnailFile?: Express.Multer.File,
    uploadedBy?: string,
  ) {
    const project = await this.projectModel.findById(
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

    // Push episode to project's episodes array
    await this.projectModel.findByIdAndUpdate(createEpisodeDto.projectId, {
      $push: { episodes: savedEpisode._id },
    });

    return {
      message: 'Episode uploaded successfully',
      episode: savedEpisode,
    };
  }

  async findAll() {
    return this.episodeModel
      .find()
      .populate('projectId', 'title slug')
      .sort({ createdAt: -1 });
  }

  async findOne(id: Types.ObjectId) {
    const episode = await this.episodeModel
      .findById(id)
      .populate('projectId', 'title slug');

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    return episode;
  }

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
        // Extract S3 key from thumbnail URL
        const oldThumbnailKey = episode.thumbnail.split('/').slice(-2).join('/');
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

  async remove(id: Types.ObjectId) {
    const episode = await this.episodeModel.findById(id);

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    // Delete file from S3
    if (episode.s3Key) {
      await this.s3Service.deleteFile(episode.s3Key);
    }

    // Remove episode from project's episodes array
    await this.projectModel.findByIdAndUpdate(episode.projectId, {
      $pull: { episodes: id },
    });

    await this.episodeModel.findByIdAndDelete(id);

    this.logger.log(`Episode deleted: ${id}`);
    return {
      message: 'Episode deleted successfully',
    };
  }
}
