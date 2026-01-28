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
import { Role } from 'src/roles/roles.enum';
import { Roles } from 'src/roles/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { Types } from 'mongoose';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  createAdmin(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // @Post('developer')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.SUPERADMIN)
  // createDeveloper(@Body() createDeveloperDto: CreateDeveloperDto) {
  //   return this.usersService.createDeveloper(createDeveloperDto);
  // }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('saved-projects')
  @UseGuards(JwtAuthGuard)
  getSavedProjects(@CurrentUser('sub') userId: string) {
    return this.usersService.getSavedProjects(userId as unknown as Types.ObjectId);
  }

  @Get('saved-reels')
  @UseGuards(JwtAuthGuard)
  getSavedReels(@CurrentUser('sub') userId: string) {
    return this.usersService.getSavedReels(userId as unknown as Types.ObjectId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.findOne(userId as unknown as Types.ObjectId);
  }
  
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.usersService.findOne(params.id);
  }


  // user update own profile only
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(userId as unknown as Types.ObjectId, updateUserDto);
  }

  // admin update user
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  update(@Param() params: MongoIdDto, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(params.id, updateUserDto);
  }

  

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  remove(@Param() params: MongoIdDto) {
    return this.usersService.remove(params.id);
  }
}
