import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Developer, DeveloperDoc } from './entities/developer.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { Role } from 'src/roles/roles.enum';
import { normalizeEmail } from 'src/auth/utils/normalize-email';
import { CreateDeveloperAccountDto } from './dto/create-developer-account.dto';

@Injectable()
export class DeveloperAuthService {
  constructor(
    @InjectModel(Developer.name)
    private developerModel: Model<DeveloperDoc>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getDeveloperByUserId(userId: string): Promise<DeveloperDoc | null> {
    return this.developerModel
      .findOne({ userId: new Types.ObjectId(userId), deletedAt: null })
      .exec();
  }

  async hasDeveloperProfile(userId: string): Promise<boolean> {
    const developer = await this.getDeveloperByUserId(userId);
    return developer != null;
  }

  async linkUserToDeveloper(
    developerId: string,
    userId: string,
  ): Promise<{ message: string; developer: DeveloperDoc }> {
    const developerObjectId = new Types.ObjectId(developerId);
    const userObjectId = new Types.ObjectId(userId);

    const developer = await this.developerModel.findById(developerObjectId);
    if (!developer) {
      throw new NotFoundException('Developer not found');
    }
    if (developer.deletedAt) {
      throw new BadRequestException('Developer profile is deleted');
    }

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== Role.DEVELOPER) {
      throw new BadRequestException(
        'User role must be DEVELOPER before linking. Update user role first.',
      );
    }

    const existingLink = await this.developerModel.findOne({
      userId: userObjectId,
      deletedAt: null,
    });
    if (existingLink && !existingLink._id.equals(developerObjectId)) {
      throw new BadRequestException(
        'User is already linked to another developer profile',
      );
    }

    const alreadyLinked = await this.developerModel.findOne({
      _id: developerObjectId,
      userId: userObjectId,
    });
    if (alreadyLinked) {
      return {
        message: 'User is already linked to this developer',
        developer: alreadyLinked,
      };
    }

    const updatedDeveloper = await this.developerModel
      .findByIdAndUpdate(
        developerObjectId,
        { $set: { userId: userObjectId } },
        { new: true },
      )
      .exec();

    if (!updatedDeveloper) {
      throw new BadRequestException('Failed to link user to developer');
    }

    return {
      message: 'User linked to developer successfully',
      developer: updatedDeveloper,
    };
  }

  async unlinkUserFromDeveloper(
    developerId: string,
  ): Promise<{ message: string; developer: DeveloperDoc }> {
    const developerObjectId = new Types.ObjectId(developerId);

    const developer = await this.developerModel.findById(developerObjectId);
    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    const updatedDeveloper = await this.developerModel
      .findByIdAndUpdate(
        developerObjectId,
        { $set: { userId: null } },
        { new: true },
      )
      .exec();

    if (!updatedDeveloper) {
      throw new BadRequestException('Failed to unlink user from developer');
    }

    return {
      message: 'User unlinked from developer successfully',
      developer: updatedDeveloper,
    };
  }

  async createDeveloperAccount(dto: CreateDeveloperAccountDto): Promise<{
    message: string;
    user: { id: string; email: string; username: string; role: string };
    developer: { id: string; name: string; email?: string; location: string };
  }> {
    const developerObjectId = new Types.ObjectId(dto.developerId);
    const developer = await this.developerModel.findById(developerObjectId);

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }
    if (developer.deletedAt) {
      throw new BadRequestException('Developer profile is deleted');
    }

    const email = developer.email?.trim();
    if (!email) {
      throw new BadRequestException(
        'Developer must have an email to create an account',
      );
    }

    if (developer.userId) {
      throw new BadRequestException(
        'This developer already has a user account',
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({
      username: developer.name,
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber: developer.phone ?? undefined,
      role: Role.DEVELOPER,
      isEmailVerified: true,
    });
    const savedUser = await user.save();

    await this.developerModel
      .findByIdAndUpdate(developerObjectId, {
        $set: { userId: savedUser._id },
      })
      .exec();

    const {
      password: _p,
      emailVerificationOTP: _o,
      emailVerificationOTPExpires: _oe,
      passwordResetOTP: _r,
      passwordResetOTPExpires: _re,
      ...userWithoutSensitive
    } = savedUser.toObject();

    return {
      message: 'Developer account created successfully',
      user: {
        id: savedUser._id.toString(),
        email: savedUser.email,
        username: savedUser.username,
        role: savedUser.role,
      },
      developer: {
        id: developer._id.toString(),
        name: developer.name,
        email: developer.email,
        location: developer.location,
      },
    };
  }
}
