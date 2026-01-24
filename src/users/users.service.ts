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
// import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // private readonly mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Only hash if password is not already hashed (doesn't start with $2b$)
    const password = createUserDto.password.startsWith('$2b$')
      ? createUserDto.password
      : await bcrypt.hash(createUserDto.password, 10);

    const user = new this.userModel({
      ...createUserDto,
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
    const user = await this.userModel.findOne({ email });
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
}
