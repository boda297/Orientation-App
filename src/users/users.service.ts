import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserByAdminDto } from './dto/updateUserByAdmin.dto';
import { UpdateUserProfileDto } from './dto/updateUserProfile.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto } from './dto/createUserByAdmin.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // Create a new user
  async create(createUserDto: CreateUserDto) {
    const user = new this.userModel(createUserDto);
    return await user
      .save()
      .then((user) => {
        return {
          message: 'User created successfully',
          user: user._id,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Create user via Google OAuth and return the full user document
  async createGoogleUser(userData: {
    username: string;
    email: string;
    provider?: string;
    googleId?: string;
    isEmailVerified: boolean;
  }) {
    const user = new this.userModel({
      ...userData,
      provider: userData.provider || 'google',
    });
    return await user.save();
  }

  // Create user via Apple OAuth and return the full user document
  async createAppleUser(userData: {
    username: string;
    email: string;
    appleId: string;
    provider?: string;
    isEmailVerified: boolean;
  }) {
    const user = new this.userModel({
      ...userData,
      provider: userData.provider || 'apple',
    });
    return await user.save();
  }

  // Find user by Apple ID
  async findByAppleId(appleId: string) {
    return await this.userModel.findOne({ appleId });
  }

  // Create user by admin and skip email verification
  async createUserByAdmin(createUserByAdminDto: CreateUserByAdminDto) {
    // first check if user already exists with this email
    const emailExists = await this.userModel.findOne({
      email: createUserByAdminDto.email,
    });
    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }
    // then check if user already exists with this username
    const usernameExists = await this.userModel.findOne({
      username: createUserByAdminDto.username,
    });
    if (usernameExists) {
      throw new BadRequestException('Username already exists');
    }

    // hash password
    const hashedPassword = await bcrypt.hash(createUserByAdminDto.password, 10);

    // create user with email verification skipped
    const user = new this.userModel({
      ...createUserByAdminDto,
      password: hashedPassword,
      isEmailVerified: true,
    });

    return await user
      .save()
      .then((user) => {
        return {
          message: 'User created successfully',
          user: user._id,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Get all users
  async findAll(limit: number, page: number) {
    const mongoQuery = this.userModel.find().select('_id email username role');

    if (limit) {
      mongoQuery.limit(limit);
    }

    if (page && limit) {
      mongoQuery.skip((page - 1) * limit);
    } else if (page) {
      const defaultLimit = 10;
      mongoQuery.skip((page - 1) * defaultLimit).limit(defaultLimit);
    }

    return await mongoQuery
      .then((users) => {
        return {
          message: 'Users fetched successfully',
          users,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Find user by ID (returns user ID only for checking if user exists)
  async findOne(id: string | Types.ObjectId) {
    try {
      const user = await this.userModel.findById(id).select('_id');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User fetched successfully',
        id: user._id,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // Find user's profile
  async findUserProfile(userId: Types.ObjectId) {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('_id username email phoneNumber');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User fetched successfully',
        user,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Find user by email
  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return null;
    }
    return user;
  }

  // Find user by ID and return the whole user object for authentication
  async findById(id: Types.ObjectId) {
    const user = await this.userModel.findById(id);
    if (!user) {
      return null;
    }
    return user;
  }

  // Get current user's saved projects
  async getSavedProjects(userId: Types.ObjectId) {
    try {
      // return only the id, title and thumbnail url of the saved projects
      const user = await this.userModel
        .findById(userId)
        .populate('savedProjects', '_id title projectThumbnailUrl');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'Saved projects fetched successfully',
        savedProjects: user.savedProjects,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async getSavedProjectIds(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const user = await this.userModel.findById(userId).select('savedProjects');
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user.savedProjects || [];
  }

  async addSavedProject(userId: Types.ObjectId, projectId: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.savedProjects.some((id) => id.toString() === projectId.toString())) {
      return { alreadySaved: true };
    }
    await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { savedProjects: projectId } },
      { new: true },
    );
    return { alreadySaved: false };
  }

  async removeSavedProject(userId: Types.ObjectId, projectId: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.savedProjects.some((id) => id.toString() === projectId.toString())) {
      throw new BadRequestException('Project not saved');
    }
    await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { savedProjects: projectId } },
      { new: true },
    );
    return { success: true };
  }

  // Get current user's saved reels
  async getSavedReels(userId: Types.ObjectId) {
    try {
      // return only the id, title and thumbnail url of the saved reels
      const user = await this.userModel
        .findById(userId)
        .populate('savedReels', '_id title reelThumbnailUrl');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'Saved reels fetched successfully',
        savedReels: user.savedReels,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async getSavedReelIds(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const user = await this.userModel.findById(userId).select('savedReels');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.savedReels || [];
  }

  async addSavedReel(userId: Types.ObjectId, reelId: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (
      user.savedReels &&
      user.savedReels.some((id) => id.toString() === reelId.toString())
    ) {
      return { alreadySaved: true };
    }
    await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { savedReels: reelId } },
      { new: true },
    );
    return { alreadySaved: false };
  }

  async removeSavedReel(userId: Types.ObjectId, reelId: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (
      !user.savedReels ||
      !user.savedReels.some((id) => id.toString() === reelId.toString())
    ) {
      throw new NotFoundException('Reel not saved');
    }
    await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { savedReels: reelId } },
      { new: true },
    );
    return { success: true };
  }

  // Update OTP fields for email verification or password reset
  async updateOTP(
    id: string,
    otpData: {
      emailVerificationOTP?: string | null;
      emailVerificationOTPExpires?: Date | null;
      passwordResetOTP?: string | null;
      passwordResetOTPExpires?: Date | null;
      isEmailVerified?: boolean;
      isPasswordResetVerified?: boolean;
    },
  ) {
    const user = await this.userModel.findByIdAndUpdate(id, otpData, {
      new: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Update user password
  async updatePassword(id: string, hashedPassword: string) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Update user by ID (for internal service calls)
  async update(id: Types.ObjectId, updateData: Partial<User>) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // Update user role only by super admin
  async updateUserRole(id: Types.ObjectId, updateUserDto: UpdateUserByAdminDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
        new: true,
        runValidators: true,
      }).select('_id email username role');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User updated successfully',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // Update user profile by ID
  async updateprofile(id: Types.ObjectId, updateUserDto: UpdateUserProfileDto) {
    try {
      const user = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, {
          new: true,
          runValidators: true,
        })
        .select('_id username email phoneNumber');
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return {
        message: 'User profile updated successfully',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // Delete user by ID
  async remove(id: Types.ObjectId) {
    try {
      const user = await this.userModel.findByIdAndDelete(id);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User deleted successfully',
        user: user._id,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // Delete unverified users whose OTP has expired
  async deleteUnverifiedExpiredUsers() {
    const now = new Date();
    const result = await this.userModel.deleteMany({
      isEmailVerified: false,
      emailVerificationOTPExpires: { $lt: now },
    });

    return {
      deletedCount: result.deletedCount || 0,
    };
  }

  // Update hashed refresh token for a user (only used internally)
  async updateHashedRefreshToken(
    id: Types.ObjectId,
    hashedRefreshToken: string | null,
  ) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { hashedRefreshToken },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
