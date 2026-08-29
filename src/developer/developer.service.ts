import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Developer, DeveloperDoc } from './entities/developer.entity';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { JoinDeveloperDto } from './dto/join-developer.dto';
import { UpdateDeveloperScriptDto } from './dto/update-developer-project.dto';
import { CreateDeveloperAccountDto } from './dto/create-developer-account.dto';
import { S3Service } from 'src/s3/s3.service';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import { Episode, EpisodeDocument } from 'src/episode/entities/episode.entity';
import { Reel, ReelDocument } from 'src/reels/entities/reel.entity';
import {
  Inventory,
  InventoryDocument,
} from 'src/files/entities/inventory.entity';
import { File, FileDocument } from 'src/files/entities/file.entity';
import { EmailService } from 'src/email/email.service';
import { ConfigService } from '@nestjs/config';
import { DeveloperAuthService } from './developer-auth.service';

@Injectable()
export class DeveloperService {
  constructor(
    @InjectModel(Developer.name)
    private developerModel: Model<DeveloperDoc>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Episode.name) private episodeModel: Model<EpisodeDocument>,
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    @InjectModel(Inventory.name)
    private inventoryModel: Model<InventoryDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private s3Service: S3Service,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly developerAuthService: DeveloperAuthService,
  ) {}

  async joinDeveloper(
    joinDeveloperDto: JoinDeveloperDto,
    meta?: { userId?: string; userEmail?: string },
  ) {
    const toEmail =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      this.configService.get<string>('SMTP_FROM');

    if (!toEmail) {
      throw new InternalServerErrorException(
        'ADMIN_NOTIFICATION_EMAIL is not configured',
      );
    }

    await this.emailService.sendJoinDeveloperRequest(toEmail, {
      userId: meta?.userId,
      userEmail: meta?.userEmail,
      ...joinDeveloperDto,
    });

    return {
      message: 'Join developer request sent successfully',
    };
  }

  // find all developers except deleted ones
  async findAllDevelopers() {
    return await this.developerModel
      .find({ deletedAt: null })
      .then((developers) => {
        return {
          message: 'Developers fetched successfully',
          developers,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // finds one developer by id
  async findOneDeveloper(id: Types.ObjectId) {
    const developer = await this.developerModel
      .findById(id)
      .populate('projects')
      .catch((error) => {
        throw new BadRequestException(`Invalid ID format: ${error.message}`);
      });
    if (!developer) {
      throw new NotFoundException(`Developer with ID ${id} not found`);
    }
    return developer;
  }

  // add project to developer's projects array
  async addProjectToDeveloper(
    developerId: Types.ObjectId,
    projectId: Types.ObjectId,
  ) {
    return this.developerModel.findByIdAndUpdate(
      developerId,
      { $addToSet: { projects: projectId } },
      { new: true },
    );
  }

  // remove project from developer's projects array
  async removeProjectFromDeveloper(
    developerId: Types.ObjectId,
    projectId: Types.ObjectId,
  ) {
    return this.developerModel.findByIdAndUpdate(
      developerId,
      { $pull: { projects: projectId } },
      { new: true },
    );
  }

  // find projects by developer id
  async findProjectsByDeveloperId(developerId: Types.ObjectId) {
    return this.projectModel
      .find({ developer: developerId, deletedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  // find projects by developer id array
  async findProjectsByIds(projectIds: Types.ObjectId[]) {
    if (!projectIds?.length) return [];
    return this.projectModel
      .find({ _id: { $in: projectIds }, deletedAt: null })
      .select('title location projectThumbnailUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getMyProfile(userId: string) {
    const developer =
      await this.developerAuthService.getDeveloperByUserId(userId);
    if (!developer) {
      throw new NotFoundException('Developer profile not found for this user');
    }
    return this.findOneDeveloper(developer._id);
  }

  async getMyProjects(userId: string) {
    const developer =
      await this.developerAuthService.getDeveloperByUserId(userId);
    if (!developer) {
      throw new NotFoundException('Developer profile not found for this user');
    }
    const projectIds = developer.projects ?? [];
    const projects = await this.findProjectsByIds(projectIds);
    return {
      message: 'Projects fetched successfully',
      projects,
      developer: {
        id: developer._id.toString(),
        name: developer.name,
        email: developer.email,
        location: developer.location,
      },
    };
  }

  async updateMyProfile(
    userId: string,
    updateDeveloperDto: UpdateDeveloperDto,
  ) {
    const developer =
      await this.developerAuthService.getDeveloperByUserId(userId);
    if (!developer) {
      throw new NotFoundException('Developer profile not found for this user');
    }
    return this.updateDeveloper(developer._id, updateDeveloperDto);
  }

  createDeveloperAccount(dto: CreateDeveloperAccountDto) {
    return this.developerAuthService.createDeveloperAccount(dto);
  }

  linkUserToDeveloper(developerId: string, userId: string) {
    return this.developerAuthService.linkUserToDeveloper(developerId, userId);
  }

  unlinkUserFromDeveloper(developerId: string) {
    return this.developerAuthService.unlinkUserFromDeveloper(developerId);
  }

  async findByName(name: string): Promise<DeveloperDoc | null> {
    return this.developerModel
      .findOne({ name, deletedAt: null })
      .collation({ locale: 'en', strength: 2 })
      .exec();
  }

  /**
   * Performs high-speed MongoDB $text index search across indexed text fields
   */
  async searchDevelopers(query: string) {
    return this.developerModel
      .find({
        $text: { $search: query },
        deletedAt: null,
      })
      .exec();
  }

  async createDeveloper(createDeveloperDto: CreateDeveloperDto) {
    const developerExists = await this.findByName(createDeveloperDto.name);
    if (developerExists) {
      throw new BadRequestException('Developer with this name already exists');
    }

    const emailExists = await this.developerModel.findOne({
      email: createDeveloperDto.email,
      deletedAt: null,
    });
    if (emailExists) {
      throw new BadRequestException('Developer with this email already exists');
    }

    const developer = new this.developerModel({
      ...createDeveloperDto,
    });
    return await developer
      .save()
      .then((dev) => {
        return {
          message: 'Developer created successfully',
          developer: dev,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // update developer project script by developer
  async updateDeveloperScript(
    userId: string,
    projectId: Types.ObjectId,
    updateDeveloperScriptDto: UpdateDeveloperScriptDto,
  ) {
    // Get developer profile for the authenticated user
    const developer =
      await this.developerAuthService.getDeveloperByUserId(userId);
    if (!developer) {
      throw new NotFoundException('Developer profile not found for this user');
    }

    // Get the project
    const project = await this.projectModel.findById(projectId);
    if (!project || project.deletedAt) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Verify ownership (Check if project belongs to this developer)
    if (project.developer.toString() !== developer._id.toString()) {
      throw new ForbiddenException('Unauthorized access to this project');
    }

    // Update script field only
    project.script = updateDeveloperScriptDto.script;
    await project.save();

    return {
      message: 'Developer project script updated successfully',
      project,
    };
  }

  // update developer details by admin or superadmin
  async updateDeveloper(
    id: Types.ObjectId,
    updateDeveloperDto: UpdateDeveloperDto,
    userEmail?: string,
  ) {
    // Find the developer
    const developer = await this.developerModel.findById(id);
    if (!developer) {
      throw new BadRequestException('Developer not found');
    }

    if (userEmail && developer.email && developer.email !== userEmail) {
      throw new BadRequestException(
        'You can only update your own developer profile',
      );
    }

    const updateData = { ...updateDeveloperDto };
    delete (updateData as any).projects;

    return await this.developerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .then((updatedDeveloper) => {
        return {
          message: 'Developer updated successfully',
          developer: updatedDeveloper,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  async remove(id: Types.ObjectId) {
    try {
      const developer = await this.developerModel.findById(id);
      if (!developer) {
        throw new BadRequestException('Developer not found');
      }

      // Get all projects owned by this developer
      const projects = await this.projectModel.find({ developer: id });

      // Delete all episodes from developer's projects
      if (projects.length > 0) {
        const projectIds = projects.map((p) => p._id);
        const episodes = await this.episodeModel.find({
          projectId: { $in: projectIds },
        });
        for (const episode of episodes) {
          if (episode.s3Key) {
            try {
              await this.s3Service.deleteFile(episode.s3Key);
            } catch (error) {
              console.error(
                `Failed to delete episode S3 file: ${episode.s3Key}`,
                error,
              );
            }
          }
        }
        await this.episodeModel.deleteMany({
          projectId: { $in: projectIds },
        });

        // Delete all reels from developer's projects
        const reels = await this.reelModel.find({
          projectId: { $in: projectIds },
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
          projectId: { $in: projectIds },
        });

        // Delete inventory from developer's projects
        const inventories = await this.inventoryModel.find({
          project: { $in: projectIds },
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
          project: { $in: projectIds },
        });

        // Delete PDFs from developer's projects
        const pdfs = await this.fileModel.find({
          project: { $in: projectIds },
        });
        for (const pdf of pdfs) {
          if (pdf.s3Key) {
            try {
              await this.s3Service.deleteFile(pdf.s3Key);
            } catch (error) {
              console.error(
                `Failed to delete PDF S3 file: ${pdf.s3Key}`,
                error,
              );
            }
          }
        }
        await this.fileModel.deleteMany({
          project: { $in: projectIds },
        });

        // Delete all projects
        await this.projectModel.deleteMany({ developer: id });
      }

      // Delete any reels or inventory directly owned by developer
      const developerReels = await this.reelModel.find({
        developerId: id,
      });
      for (const reel of developerReels) {
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
      await this.reelModel.deleteMany({ developerId: id });

      const developerInventories = await this.inventoryModel.find({
        developer: id,
      });
      for (const inventory of developerInventories) {
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
      await this.inventoryModel.deleteMany({ developer: id });

      const developerPdfs = await this.fileModel.find({
        developer: id,
      });
      for (const pdf of developerPdfs) {
        if (pdf.s3Key) {
          try {
            await this.s3Service.deleteFile(pdf.s3Key);
          } catch (error) {
            console.error(`Failed to delete PDF S3 file: ${pdf.s3Key}`, error);
          }
        }
      }
      await this.fileModel.deleteMany({ developer: id });

      // Finally delete the developer
      const deletedDeveloper = await this.developerModel.findByIdAndDelete(id);

      return {
        message: 'Developer and all associated data deleted successfully',
        developer: deletedDeveloper,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
