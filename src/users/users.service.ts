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
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { escapeRegExp, normalizeEmail } from '../auth/utils/normalize-email';
// import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const password = createUserDto.password.startsWith('$2b$')
      ? createUserDto.password
      : await bcrypt.hash(createUserDto.password, 10);

    const user = new this.userModel({
      ...createUserDto,
      email: normalizeEmail(createUserDto.email),
      password,
    });
    return await user
      .save()
      .then((user) => {
        return {
          message: 'User created successfully',
          user,
        };
      })
      .catch((error) => {
        throw new BadRequestException(error.message);
      });
  }

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

  async findOne(id: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(id);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'User fetched successfully',
        user,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async findByEmail(email: string) {
    const normalized = normalizeEmail(email);
    // Case-insensitive exact match (handles old records saved with different casing)
    const user = await this.userModel.findOne({
      email: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' },
    });
    if (!user) {
      return null;
    }
    return user;
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      return null;
    }
    return user;
  }

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

  /**
   * Update OTP fields for email verification or password reset
   */
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

  /**
   * Update user password
   */
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

  /**
   * Delete unverified users whose OTP has expired
   * Returns the number of deleted users
   */
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
}
