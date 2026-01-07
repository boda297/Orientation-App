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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDoc>,
    private developerService: DeveloperService,
    private s3Service: S3Service,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    logo?: Express.Multer.File,
    heroVideo?: Express.Multer.File,
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

    // Create project with normalized slug
    const projectData: any = {
      ...createProjectDto,
      slug,
      heroVideoUrl,
    };

    // Add logo URL if uploaded
    if (logoUrl) {
      projectData.logoUrl = logoUrl;
    }

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
    const mongoQuery = this.projectModel.find({ deletedAt: null });
    mongoQuery.populate('developer');
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

  async update(id: Types.ObjectId, updateProjectDto: UpdateProjectDto) {
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

  async remove(id: Types.ObjectId) {
    const deletedProject = await this.projectModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );
    if (!deletedProject) {
      throw new BadRequestException('Project not found');
    }
    return {
      message: 'Project deleted successfully',
      project: deletedProject,
    };
  }
}
