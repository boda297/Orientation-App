import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Developer, DeveloperDoc } from './entities/developer.entity';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperScriptDto } from './dto/update-developer-project.dto';
import { S3Service } from 'src/s3/s3.service';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import { Episode, EpisodeDocument } from 'src/episode/entities/episode.entity';
import { Reel, ReelDocument } from 'src/reels/entities/reel.entity';
import {
  Inventory,
  InventoryDocument,
} from 'src/files/entities/inventory.entity';
import { File, FileDocument } from 'src/files/entities/file.entity';

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
  ) {}

  async findAllDevelopers() {
    // find all developers except deleted ones
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

  findOneDeveloper(id: Types.ObjectId) {
    return this.developerModel.findById(id).populate('projects');
  }

  async findByName(name: string): Promise<DeveloperDoc | null> {
    return this.developerModel.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      deletedAt: null,
    });
  }

  async createDeveloper(createDeveloperDto: CreateDeveloperDto) {
    const developerExists = await this.findByName(createDeveloperDto.name);
    console.log(developerExists);
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
    id: Types.ObjectId,
    updateDeveloperScriptDto: UpdateDeveloperScriptDto,
  ) {
    return await this.developerModel
      .findByIdAndUpdate(
        id,
        { script: updateDeveloperScriptDto.script },
        { new: true },
      )
      .then((updatedDeveloper) => {
        return {
          message: 'Developer project updated successfully',
          developer: updatedDeveloper,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
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
