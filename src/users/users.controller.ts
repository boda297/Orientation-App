import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { Role } from '../auth/enum/roles.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Types } from 'mongoose';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @access : Accessible by Superadmin only
  // @description : Create a new user
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // @access : Accessible by Superadmin and Admin
  // @description : Get all users
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // @access : Authenticated users (JWT)
  // @description : Get current user's saved projects
  @Get('saved-projects')
  @UseGuards(JwtAuthGuard)
  getSavedProjects(@CurrentUser('sub') userId: string) {
    return this.usersService.getSavedProjects(
      userId as unknown as Types.ObjectId,
    );
  }

  // @access : Authenticated users (JWT)
  // @description : Get current user's saved reels
  @Get('saved-reels')
  @UseGuards(JwtAuthGuard)
  getSavedReels(@CurrentUser('sub') userId: string) {
    return this.usersService.getSavedReels(userId as unknown as Types.ObjectId);
  }

  // @access : Authenticated users (JWT)
  // @description : Get current user's profile
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req) {
    return this.usersService.findOne(req.user.sub);
  }

  // @access : Accessible by Superadmin and Admin
  // @description : Get user by ID
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.usersService.findOne(params.id);
  }

  // @access : Authenticated users (JWT)
  // @description : Update current user's profile
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(
      userId as unknown as Types.ObjectId,
      updateUserDto,
    );
  }

  // @access : Accessible by Superadmin and Admin
  // @description : Update user by ID
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  update(@Param() params: MongoIdDto, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(params.id, updateUserDto);
  }

  // @access : Accessible by Superadmin only
  // @description : Delete user by ID
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  remove(@Param() params: MongoIdDto) {
    return this.usersService.remove(params.id);
  }
}
