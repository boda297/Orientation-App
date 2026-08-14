import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // Create a new user
  async create(createUserDto: CreateUserDto) {
    const user = new this.userModel(createUserDto);
    return await user
      .save()
      .then((user) => {
        const { password, ...userWithoutPassword } = user.toObject();
        return {
          message: 'User created successfully',
          user: userWithoutPassword,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

  // Get all users
  async findAll() {
    return await this.userModel
      .find()
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

  // Find user by ID (returns user ID only)
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

  // Find user by email
  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return null;
    }
    return user;
  }

  // Find user by ID
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
      const user = await this.userModel
        .findById(userId)
        .populate('savedProjects', 'title projectThumbnailUrl');

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

  // Get current user's saved reels
  async getSavedReels(userId: Types.ObjectId) {
    try {
      const user = await this.userModel
        .findById(userId)
        .populate('savedReels', 'title reelThumbnailUrl');

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

  // Update OTP fields for email verification or password reset
  async updateOTP(
    id: string,
    otpData: {
      emailVerificationOTP?: string | null;
      emailVerificationOTPExpires?: Date | null;
      passwordResetOTP?: string | null;
      passwordResetOTPExpires?: Date | null;
      isEmailVerified?: boolean;
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

  // Update user by ID
  async update(id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
        new: true,
        runValidators: true,
      });

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
  async updateprofile(id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
        new: true,
      });
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
        user,
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
