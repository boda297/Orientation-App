import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReelDto } from './dto/create-reel.dto';
import { UpdateReelDto } from './dto/update-reel.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reel, ReelDocument } from './entities/reel.entity';
import { Model, Types } from 'mongoose';
import { S3Service } from 'src/s3/s3.service';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import {
  Developer,
  DeveloperDoc,
} from 'src/developer/entities/developer.entity';

@Injectable()
export class ReelsService {
  constructor(
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDoc>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private s3Service: S3Service,
  ) {}

  async uploadReel(
    createReelDto: CreateReelDto,
    file: Express.Multer.File,
    thumbnail: Express.Multer.File,
  ) {
    const project = await this.projectModel.findById(createReelDto.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const developer = await this.developerModel.findById(project.developer);
    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    // Upload reel to S3
    const { key, url } = await this.s3Service.uploadFile(file, 'reels');

    //upload thumbnail to S3
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
    // Push reel to project's reels all data array
    await this.projectModel.findByIdAndUpdate(createReelDto.projectId, {
      $push: { reels: savedReel._id },
    });
    return {
      message: 'Reel uploaded successfully',
      reel: savedReel,
    };
  }

  async findAllReels() {
    return this.reelModel
      .find()
      .populate('projectId')
      .populate('developerId', 'name logoUrl')
      .sort({ createdAt: -1 });
  }

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

  async removeReel(id: Types.ObjectId) {
    const reel = await this.reelModel.findByIdAndDelete(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }
    // Pull reel from project's reels array
    await this.projectModel.findByIdAndUpdate(reel.projectId, {
      $pull: { reels: reel._id },
    });
    // Delete reel from S3
    await this.s3Service.deleteFile(reel.s3Key);
    // Delete thumbnail from S3
    await this.s3Service.deleteFile(reel.thumbnail || '');
    return {
      message: 'Reel deleted successfully',
    };
  }

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

  async saveReel(id: Types.ObjectId, userId: Types.ObjectId) {
    const reel = await this.reelModel.findById(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    //check if reel is already saved
    if (user.savedReels.includes(id)) {
      return { message: 'Reel already saved' };
    }
    //increment save count
    await this.reelModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: 1 } },
      { new: true },
    );
    //save reel
    await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { savedReels: id } },
      { new: true },
    );
    return { message: 'Reel saved successfully' };
  }

  async unsaveReel(id: Types.ObjectId, userId: Types.ObjectId) {
    const reel = await this.reelModel.findById(id);
    if (!reel) {
      throw new NotFoundException('Reel not found');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    //check if reel is not saved
    if (!user.savedReels.includes(id)) {
      throw new NotFoundException('Reel not saved');
    }
    //decrement save count
    await this.reelModel.findByIdAndUpdate(
      id,
      { $inc: { saveCount: -1 } },
      { new: true },
    );
    //unsave reel
    await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { savedReels: id } },
      { new: true },
    );
    return { message: 'Reel unsaved successfully' };
  }

  async getSavedReelsByUser(userId: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const reels = await this.reelModel.find({ _id: { $in: user.savedReels } });
    return {
      message: 'Saved reels fetched successfully',
      reels,
    };
  }
}
