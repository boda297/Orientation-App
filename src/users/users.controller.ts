import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserByAdminDto } from './dto/updateUserByAdmin.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { Role } from '../auth/enum/roles.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Types } from 'mongoose';
import { CreateUserByAdminDto } from './dto/createUserByAdmin.dto';
import { UpdateUserProfileDto } from './dto/updateUserProfile.dto';

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

  // @access : Accessible by Superadmin only
  // @description : Create a new user by admin without email verification
  @Post('createUserByAdmin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  createUserByAdmin(@Body() createUserByAdminDto: CreateUserByAdminDto) {
    return this.usersService.createUserByAdmin(createUserByAdminDto);
  }

  // @access : Accessible by Superadmin and Admin
  // @description : Get all users
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findAll(@Query('limit') limit: number, @Query('page') page: number) {
    return this.usersService.findAll(limit, page);
  }

  // @access : Authenticated users (JWT)
  // @description : Get current user's saved projects
  @Get('saved-projects')
  @UseGuards(JwtAuthGuard)
  getSavedProjects(@Req() req) {
    return this.usersService.getSavedProjects(req.user.sub as Types.ObjectId);
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
    return this.usersService.findUserProfile(req.user.sub);
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
  @Patch('updateProfile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() req, @Body() updateUserDto: UpdateUserProfileDto) {
    return this.usersService.updateprofile(req.user.sub, updateUserDto);
  }

  // @access : Accessible by Superadmin only
  // @description : Update user's role by ID
  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  updateUserRole(@Param() params: MongoIdDto, @Body() updateUserDto: UpdateUserByAdminDto) {
    return this.usersService.updateUserRole(params.id, updateUserDto);
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
