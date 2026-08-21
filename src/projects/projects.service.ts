import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateUpcommingProjectDto } from './dto/create-upcomming-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './entities/project.entity';
import { InjectModel } from '@nestjs/mongoose';
import { DeveloperService } from 'src/developer/developer.service';
import { S3Service } from 'src/s3/s3.service';
import { QueryProjectDto } from './dto/query-project.dto';
import { UsersService } from 'src/users/users.service';
import { EpisodeService } from 'src/episode/episode.service';
import { ReelsService } from 'src/reels/reels.service';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private readonly usersService: UsersService,
    private readonly developerService: DeveloperService,
    @Inject(forwardRef(() => EpisodeService))
    private readonly episodeService: EpisodeService,
    @Inject(forwardRef(() => ReelsService))
    private readonly reelsService: ReelsService,
    private readonly filesService: FilesService,
    private readonly s3Service: S3Service,
  ) {}

  /*
  =========================================  
        Core CRUD & Route Functions
  =========================================  
  */

  // Create Upcoming Project
  async createUpcommingProject(
    createUpcommingProjectDto: CreateUpcommingProjectDto,
    projectThumbnail?: Express.Multer.File,
  ) {
    // Verify developer exists
    const developer = await this.developerService.findOneDeveloper(
      createUpcommingProjectDto.developer,
    );

    if (!developer) {
      throw new BadRequestException('Developer not found');
    }

    // Normalize slug: lowercase and replace spaces with hyphens
    const slug = createUpcommingProjectDto.title
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Upload project thumbnail to S3 if provided
    let projectThumbnailUrl: string | undefined;
    if (projectThumbnail) {
      const { url } = await this.s3Service.uploadFile(
        projectThumbnail,
        'images',
      );
      projectThumbnailUrl = url;
    }

    if (!projectThumbnailUrl) {
      throw new BadRequestException('Project thumbnail is required');
    }

    // Create project with normalized slug and status PLANNING
    const projectData: any = {
      ...createUpcommingProjectDto,
      slug,
      projectThumbnailUrl: projectThumbnailUrl,
      status: 'PLANNING',
      heroVideoUrl: 'PENDING',
      script: 'PENDING',
    };

    const project = new this.projectModel(projectData);

    try {
      // Save the project first
      const savedProject = await project.save();

      // Push project to developer's projects array
      await this.developerService.addProjectToDeveloper(
        createUpcommingProjectDto.developer,
        savedProject._id,
      );

      return {
        message: 'Upcoming project created successfully',
        project: savedProject._id,
      };
    } catch (error) {
      // Handle duplicate key error (unique constraint violation)
      if (error.code === 11000) {
        throw new BadRequestException('Project with this Title already exists');
      }
      throw new BadRequestException(error.message);
    }
  }

  // Create Project
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

    if (!projectThumbnailUrl) {
      throw new BadRequestException('Project thumbnail is required');
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
      await this.developerService.addProjectToDeveloper(
        createProjectDto.developer,
        savedProject._id,
      );

      return {
        message: 'Project created successfully',
        project: savedProject._id,
      };
    } catch (error) {
      // Handle duplicate key error (unique constraint violation)
      if (error.code === 11000) {
        throw new BadRequestException('Project with this Title already exists');
      }
      throw new BadRequestException(error.message);
    }
  }

  // Get All Projects
  findAll(query: QueryProjectDto) {
    const { developerId, location, status, title, limit, page, sortBy } = query;
    const mongoQuery = this.projectModel
      .find({ deletedAt: null })
      .select(
        '_id slug title location developer status createdAt published projectThumbnailUrl',
      );
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

  // Find One Project
  async findOne(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    await project.populate([
      { path: 'developer', select: 'name logoUrl' },
      {
        path: 'episodes',
        select: 'title thumbnail episodeUrl duration episodeOrder',
      },
      { path: 'reels', select: 'videoUrl thumbnail title' },
      { path: 'inventory', select: 'title inventoryUrl' },
      { path: 'pdf', select: 'title pdfUrl' },
    ]);
    await this.incrementViewCount(id);
    return project;
  }

  // Find Featured Projects
  async findFeatured(limit: number = 10) {
    const projects = await this.projectModel
      .find({ deletedAt: null, featured: true })
      .select('_id title location status developer slug heroVideoUrl logoUrl')
      .limit(limit)
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });

    return projects.map((project) => ({
      _id: project._id,
      title: project.title,
      location: project.location,
      ad_url: project.heroVideoUrl,
      adUrl: project.heroVideoUrl,
      heroVideoUrl: project.heroVideoUrl,
    }));
  }

  // Find Latest Projects except upcoming projects
  findLatest(limit: number = 10) {
    return this.projectModel
      .find({ deletedAt: null, status: { $ne: 'PLANNING' } })
      .select(
        '_id title slug status location developer published projectThumbnailUrl',
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Upcoming Projects
  findUpcoming(limit: number = 10) {
    return this.projectModel
      .find({ deletedAt: null, status: 'PLANNING' })
      .select(
        '_id title slug status location developer published projectThumbnailUrl',
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Trending Projects
  async findTrending(limit: number = 10) {
    const projects = await this.projectModel
      .find({ deletedAt: null })
      .select(
        '_id slug title location status developer published projectThumbnailUrl trendingScore saveCount viewCount createdAt',
      )
      .sort({ trendingScore: -1 })
      .limit(limit)
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
    return projects.map((project, index) => ({
      rank: index + 1,
      ...project.toObject(),
    }));
  }

  // Find Projects by Location
  findProjectByLocation(location: string, limit: number = 10) {
    if (!location) {
      throw new BadRequestException('Location query parameter is required');
    }
    return this.projectModel
      .find({
        deletedAt: null,
        location: { $regex: new RegExp(location.trim(), 'i') },
      })
      .select(
        '_id slug title status location developer published projectThumbnailUrl',
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Project by Status
  findProjectByStatus(status: string) {
    return this.projectModel
      .find({ deletedAt: null, status: status })
      .select('_id slug title location developer published projectThumbnailUrl')
      .sort({ createdAt: -1 })
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Project by Title
  findProjectByTitle(title: string) {
    return this.projectModel
      .find({ deletedAt: null, title: title })
      .select(
        '_id slug title location developer status createdAt published projectThumbnailUrl',
      )
      .collation({ locale: 'en', strength: 2 })
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Saved Projects for users
  async findSavedProjects(userId: Types.ObjectId) {
    const savedProjectIds = await this.usersService.getSavedProjectIds(userId);
    return this.projectModel
      .find({ deletedAt: null, _id: { $in: savedProjectIds } })
      .select(
        '_id slug title location developer status createdAt published projectThumbnailUrl',
      )
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find Projects by Developer
  async findByDeveloper(developer: string) {
    return this.projectModel
      .find({ deletedAt: null, developer: developer })
      .select(
        '_id slug title location developer status createdAt published projectThumbnailUrl',
      )
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Update Project
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
      .select(
        '-deletedAt -__v -trendingScore -saveCount -viewCount -publishedAt -deletedAt',
      )
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

  // Save Project for users
  async saveProject(id: Types.ObjectId, userId: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const result = await this.usersService.addSavedProject(userId, id);
    if (result.alreadySaved) {
      return { message: 'Project already saved' };
    }
    await this.projectModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: 1 } },
      { new: true },
    );
    await this.calculateTrendingScore(id);
    return { message: 'Project saved successfully' };
  }

  // Unsave Project for users
  async unsaveProject(id: Types.ObjectId, userId: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    await this.usersService.removeSavedProject(userId, id);
    await this.projectModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: -1 } },
      { new: true },
    );
    await this.calculateTrendingScore(id);
    return { message: 'Project unsaved successfully' };
  }

  // Publish Project
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

  // Unpublish Project
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

  // --- Delete Operations ---

  // Soft Delete Project
  async remove(id: Types.ObjectId) {
    const project = await this.projectModel.findById(id);
    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Delete all episodes and their S3 files via EpisodeService
    if (project.episodes && project.episodes.length > 0) {
      await this.episodeService.deleteManyByIds(project.episodes);
    }

    // Delete all reels and their S3 files via ReelsService
    if (project.reels && project.reels.length > 0) {
      await this.reelsService.deleteManyByIds(project.reels);
    }

    // Delete inventory and its S3 file via FilesService
    if (project.inventory) {
      const inventoryIds = Array.isArray(project.inventory)
        ? project.inventory
        : [project.inventory];
      await this.filesService.deleteInventoriesByIds(inventoryIds);
    }

    // Delete all PDFs and their S3 files via FilesService
    if (project.pdf && project.pdf.length > 0) {
      await this.filesService.deletePdfsByIds(project.pdf);
    }

    // Remove project from developer's projects list
    if (project.developer) {
      await this.developerService.removeProjectFromDeveloper(
        project.developer,
        project._id,
      );
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

  /*
  =========================================  
              Helper Functions
  =========================================  
  */

  // Search Projects for mongodb text index
  searchProjects(query: string) {
    return this.projectModel
      .find({
        $text: { $search: query },
        deletedAt: null,
      })
      .exec()
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Increment View Count
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

  // Calculate Trending Score for projects
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

  // Recalculate Trending Scores
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

  // Find Project by ID (Internal helper for other services)
  async findProjectById(id: Types.ObjectId) {
    return this.projectModel.findOne({ _id: id, deletedAt: null });
  }

  // Add Episode to Project
  async addEpisodeToProject(
    projectId: Types.ObjectId,
    episodeId: Types.ObjectId,
  ) {
    return this.projectModel.findByIdAndUpdate(
      projectId,
      { $addToSet: { episodes: episodeId } },
      { new: true },
    );
  }

  // Remove Episode from Project
  async removeEpisodeFromProject(
    projectId: Types.ObjectId,
    episodeId: Types.ObjectId,
  ) {
    return this.projectModel.findByIdAndUpdate(
      projectId,
      { $pull: { episodes: episodeId } },
      { new: true },
    );
  }

  // Add Reel to Project
  async addReelToProject(projectId: Types.ObjectId, reelId: Types.ObjectId) {
    return this.projectModel.findByIdAndUpdate(
      projectId,
      { $addToSet: { reels: reelId } },
      { new: true },
    );
  }

  // Remove Reel from Project
  async removeReelFromProject(
    projectId: Types.ObjectId,
    reelId: Types.ObjectId,
  ) {
    return this.projectModel.findByIdAndUpdate(
      projectId,
      { $pull: { reels: reelId } },
      { new: true },
    );
  }

  // Extract S3 Key from URL
  private extractS3KeyFromUrl(url: string): string {
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/');
  }
}
