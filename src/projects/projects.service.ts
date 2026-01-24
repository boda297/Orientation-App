import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './entities/project.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { DeveloperService } from 'src/developer/developer.service';
import {
  Developer,
  DeveloperDoc,
} from 'src/developer/entities/developer.entity';
import { S3Service } from 'src/s3/s3.service';
import { Episode, EpisodeDocument } from 'src/episode/entities/episode.entity';
import { Reel, ReelDocument } from 'src/reels/entities/reel.entity';
import {
  Inventory,
  InventoryDocument,
} from 'src/files/entities/inventory.entity';
import { File, FileDocument } from 'src/files/entities/file.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDoc>,
    @InjectModel(Episode.name) private episodeModel: Model<EpisodeDocument>,
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    @InjectModel(Inventory.name)
    private inventoryModel: Model<InventoryDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private developerService: DeveloperService,
    private s3Service: S3Service,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    logo?: Express.Multer.File,
    heroVideo?: Express.Multer.File,
    projectThumbnail?: Express.Multer.File,
  ) {
    // Verify developer exists
    const developer = await this.developerService.findOneDeveloper(
      createProjectDto.developer,
    );

    if (!developer) {
      throw new BadRequestException('Developer not found');
    }

    // Normalize slug: lowercase and replace spaces with hyphens
    const slug = createProjectDto.title
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Upload logo to S3 if provided
    let logoUrl: string | undefined;
    if (logo) {
      const { url } = await this.s3Service.uploadFile(logo, 'images');
      logoUrl = url;
    }

    // Upload hero video to S3 if provided
    let heroVideoUrl: string | undefined;
    if (heroVideo) {
      const { url } = await this.s3Service.uploadFile(heroVideo, 'episodes');
      heroVideoUrl = url;
    }

    if (!heroVideoUrl) {
      throw new BadRequestException('Hero video is required');
    }

    // Upload project thumbnail to S3 if provided
    let projectThumbnailUrl: string | undefined;
    if (projectThumbnail) {
      const { url } = await this.s3Service.uploadFile(
        projectThumbnail,
        'images',
      );
      projectThumbnailUrl = url;
    }

    // Create project with normalized slug
    const projectData: any = {
      ...createProjectDto,
      slug,
      heroVideoUrl,
      projectThumbnailUrl,
      logoUrl,
    };

    const project = new this.projectModel(projectData);

    try {
      // Save the project first
      const savedProject = await project.save();

      // Push project to developer's projects array
      await this.developerModel.findByIdAndUpdate(
        createProjectDto.developer,
        { $push: { projects: savedProject._id } },
        { new: true },
      );

      return {
        message: 'Project created successfully',
        project: savedProject,
      };
    } catch (error) {
      // Handle duplicate key error (unique constraint violation)
      if (error.code === 11000) {
        throw new BadRequestException('Project with this Title already exists');
      }
      throw new BadRequestException(error.message);
    }
  }

  findAll(query: QueryProjectDto) {
    const { developerId, location, status, title, slug, limit, page, sortBy } =
      query;
    // Populate developer with name and logoUrl and episodes and reels
    const mongoQuery = this.projectModel.find({ deletedAt: null });
    mongoQuery.populate('developer', 'name logoUrl');
    mongoQuery.populate(
      'episodes',
      'title thumbnail episodeUrl episodeOrder duration',
    );
    mongoQuery.populate('reels', 'title videoUrl thumbnail');
    if (developerId) {
      mongoQuery.where('developer').equals(developerId);
    }
    if (location) {
      mongoQuery.where('location').equals(location);
    }
    if (status) {
      mongoQuery.where('status').equals(status);
    }
    if (title) {
      mongoQuery.where('title').equals(title);
    }
    if (slug) {
      mongoQuery.where('slug').equals(slug);
    }
    if (limit) {
      mongoQuery.limit(limit);
    }
    if (page && limit) {
      mongoQuery.skip((page - 1) * limit);
    }
    if (sortBy) {
      const sortField = sortBy === 'newest' ? 'createdAt' : sortBy;
      mongoQuery.sort({ [sortField]: -1 });
    } else {
      mongoQuery.sort({ createdAt: -1 });
    }
    return mongoQuery.exec();
  }

  async findOne(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    // populate developer with name and logoUrl
    project.populate('developer', 'name logoUrl');
    project.populate('episodes', 'title thumbnail episodeUrl');
    project.populate('reels', 'videoUrl thumbnail');
    await this.incrementViewCount(id);
    return project;
  }

  async incrementViewCount(id: Types.ObjectId) {
    const updatedProject = await this.projectModel.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true },
    );
    if (!updatedProject) {
      throw new BadRequestException('Project not found');
    }
    await this.calculateTrendingScore(id);
    return updatedProject;
  }

  async calculateTrendingScore(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const views = project.viewCount || 0;
    const saves = project.saveCount || 0;
    const createdAt = (project as any).createdAt
      ? new Date((project as any).createdAt)
      : new Date(project._id.getTimestamp());
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const baseScore = views * 1 + saves * 5;
    const timeDecay = Math.pow(1 + hoursSinceCreation / 24, 1.5);
    const trendingScore = baseScore / timeDecay;
    await this.projectModel.findByIdAndUpdate(id, {
      trendingScore: Math.round(trendingScore * 100) / 100,
    });
    return trendingScore;
  }

  async recalculateAllTrendingScores() {
    const projects = await this.projectModel.find({ deletedAt: null });
    const updates = projects.map((project) =>
      this.calculateTrendingScore(project._id),
    );
    await Promise.all(updates);
    return {
      message: `Updated trending scores for ${projects.length} projects`,
    };
  }

  async findTrending(limit: number = 10) {
    const projects = await this.projectModel
      .find({ deletedAt: null })
      .populate('developer')
      .sort({ trendingScore: -1 })
      .limit(limit)
      .exec();
    return projects.map((project, index) => ({
      rank: index + 1,
      ...project.toObject(),
    }));
  }

  async saveProject(id: Types.ObjectId, userId: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.savedProjects.includes(id)) {
      return { message: 'Project already saved' };
    }
    await this.projectModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: 1 } },
      { new: true },
    );
    await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { savedProjects: id } },
      { new: true },
    );
    await this.calculateTrendingScore(id);
    return { message: 'Project saved successfully' };
  }

  async unsaveProject(id: Types.ObjectId, userId: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.savedProjects.includes(id)) {
      throw new BadRequestException('Project not saved');
    }
    await this.projectModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: -1 } },
      { new: true },
    );
    await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { savedProjects: id } },
      { new: true },
    );
    await this.calculateTrendingScore(id);
    return { message: 'Project unsaved successfully' };
  }

  async update(
    id: Types.ObjectId,
    updateProjectDto: UpdateProjectDto,
    logo?: Express.Multer.File,
    heroVideo?: Express.Multer.File,
    projectThumbnail?: Express.Multer.File,
  ) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }

    if (updateProjectDto.title) {
      updateProjectDto.title = updateProjectDto.title
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const projectWithSameSlug = await this.projectModel.findOne({
        title: updateProjectDto.title,
        _id: { $ne: id },
      });
      if (projectWithSameSlug) {
        throw new BadRequestException('Project with this slug already exists');
      }
    }
    if (updateProjectDto.developer) {
      const developer = await this.developerService.findOneDeveloper(
        updateProjectDto.developer,
      );
      if (!developer) {
        throw new BadRequestException('Developer not found');
      }
    }

    // Handle logo update
    if (logo) {
      // Delete old logo from S3 if it exists
      if (project.logoUrl) {
        try {
          // Extract S3 key from URL
          const oldKey = this.extractS3KeyFromUrl(project.logoUrl);
          await this.s3Service.deleteFile(oldKey);
        } catch (error) {
          console.error('Failed to delete old logo from S3', error);
        }
      }
      const { url } = await this.s3Service.uploadFile(logo, 'images');
      updateProjectDto.logoUrl = url;
    }

    // Handle hero video update
    if (heroVideo) {
      // Delete old hero video from S3 if it exists
      if (project.heroVideoUrl) {
        try {
          const oldKey = this.extractS3KeyFromUrl(project.heroVideoUrl);
          await this.s3Service.deleteFile(oldKey);
        } catch (error) {
          console.error('Failed to delete old hero video from S3', error);
        }
      }
      const { url } = await this.s3Service.uploadFile(heroVideo, 'episodes');
      updateProjectDto.heroVideoUrl = url;
    }

    // Handle project thumbnail update
    if (projectThumbnail) {
      // Delete old thumbnail from S3 if it exists
      if (project.projectThumbnailUrl) {
        try {
          const oldKey = this.extractS3KeyFromUrl(project.projectThumbnailUrl);
          await this.s3Service.deleteFile(oldKey);
        } catch (error) {
          console.error('Failed to delete old thumbnail from S3', error);
        }
      }
      const { url } = await this.s3Service.uploadFile(
        projectThumbnail,
        'images',
      );
      (updateProjectDto as any).projectThumbnailUrl = url;
    }

    const updatedProject = await this.projectModel
      .findByIdAndUpdate(id, updateProjectDto, {
        new: true,
        runValidators: true,
      })
      .catch((error) => {
        if (error.code === 11000) {
          throw new BadRequestException(
            'Project with this slug already exists',
          );
        }
        throw new BadRequestException(error.message);
      });

    if (!updatedProject) {
      throw new BadRequestException('Project not found');
    }

    return {
      message: 'Project updated successfully',
      project: updatedProject,
    };
  }

  private extractS3KeyFromUrl(url: string): string {
    // Extract S3 key from CloudFront URL
    // URL format: https://cloudfront.../images/uuid-filename
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/');
  }

  async remove(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Delete all episodes and their S3 files
    if (project.episodes && project.episodes.length > 0) {
      const episodes = await this.episodeModel.find({
        _id: { $in: project.episodes },
      });
      for (const episode of episodes) {
        if (episode.s3Key) {
          try {
            await this.s3Service.deleteFile(episode.s3Key);
          } catch (error) {
            // Log error but continue deletion
            console.error(
              `Failed to delete episode S3 file: ${episode.s3Key}`,
              error,
            );
          }
        }
      }
      await this.episodeModel.deleteMany({
        _id: { $in: project.episodes },
      });
    }

    // Delete all reels and their S3 files
    if (project.reels && project.reels.length > 0) {
      const reels = await this.reelModel.find({
        _id: { $in: project.reels },
      });
      for (const reel of reels) {
        if (reel.s3Key) {
          try {
            await this.s3Service.deleteFile(reel.s3Key);
          } catch (error) {
            console.error(
              `Failed to delete reel S3 file: ${reel.s3Key}`,
              error,
            );
          }
        }
      }
      await this.reelModel.deleteMany({
        _id: { $in: project.reels },
      });
    }

    // Delete inventory and its S3 file
    if (project.inventory) {
      const inventoryIds = Array.isArray(project.inventory)
        ? project.inventory
        : [project.inventory];
      const inventories = await this.inventoryModel.find({
        _id: { $in: inventoryIds },
      });
      for (const inventory of inventories) {
        if (inventory.s3Key) {
          try {
            await this.s3Service.deleteFile(inventory.s3Key);
          } catch (error) {
            console.error(
              `Failed to delete inventory S3 file: ${inventory.s3Key}`,
              error,
            );
          }
        }
      }
      await this.inventoryModel.deleteMany({
        _id: { $in: inventoryIds },
      });
    }

    // Delete all PDFs and their S3 files
    if (project.pdf && project.pdf.length > 0) {
      const pdfs = await this.fileModel.find({
        _id: { $in: project.pdf },
      });
      for (const pdf of pdfs) {
        if (pdf.s3Key) {
          try {
            await this.s3Service.deleteFile(pdf.s3Key);
          } catch (error) {
            console.error(`Failed to delete PDF S3 file: ${pdf.s3Key}`, error);
          }
        }
      }
      await this.fileModel.deleteMany({
        _id: { $in: project.pdf },
      });
    }

    // Soft delete the project
    const deletedProject = await this.projectModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );

    return {
      message: 'Project and all associated data deleted successfully',
      project: deletedProject,
    };
  }

  async publish(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    if (project.published) {
      return { message: 'Project is already published', project };
    }
    const publishedProject = await this.projectModel.findByIdAndUpdate(
      id,
      { published: true, publishedAt: new Date() },
      { new: true },
    );
    return {
      message: 'Project published successfully',
      project: publishedProject,
    };
  }

  async unpublish(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    if (!project.published) {
      return { message: 'Project is already unpublished', project };
    }
    const unpublishedProject = await this.projectModel.findByIdAndUpdate(
      id,
      { published: false, publishedAt: null },
      { new: true },
    );
    return {
      message: 'Project unpublished successfully',
      project: unpublishedProject,
    };
  }
}
