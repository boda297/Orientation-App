import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { UpdateDeveloperScriptDto } from './dto/update-developer-project.dto';
import { JoinDeveloperDto } from './dto/join-developer.dto';
import { CreateDeveloperAccountDto } from './dto/create-developer-account.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Types } from 'mongoose';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  /**
   * @Accessible by admin and superadmin
   * @description Returns All developers
   * @returns Array of All developers
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findAll() {
    return this.developerService.findAllDevelopers();
  }

  /**
   * @Accessible by developer
   * @description Returns Current developer's profile
   * @returns Current developer's profile
   */
  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  getMyProfile(@CurrentUser('sub') userId: string) {
    return this.developerService.getMyProfile(userId);
  }

  /**
   * @Accessible by developer
   * @description Returns Current developer's projects
   * @returns Current developer's projects
   */
  @Get('me/projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  getMyProjects(@CurrentUser('sub') userId: string) {
    return this.developerService.getMyProjects(userId);
  }

  /**
   * @Accessible by developer
   * @description Returns Updated developer profile
   * @returns Updated developer profile
   */
  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  updateMyProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateDeveloperDto: UpdateDeveloperDto,
  ) {
    return this.developerService.updateMyProfile(userId, updateDeveloperDto);
  }

  /**
   * @Accessible by admin and superadmin
   * @description Returns Single developer profile
   * @returns Single developer profile
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.developerService.findOneDeveloper(params.id);
  }

  /**
   * @Accessible by admin and superadmin
   * @description Creates developer profile
   * @returns Developer profile
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  create(@Body() createDeveloperDto: CreateDeveloperDto) {
    return this.developerService.createDeveloper(createDeveloperDto);
  }

  /**
   * @Accessible by admin and superadmin
   * @description Creates developer profile with user account
   * @returns Developer profile with user account
   */
  @Post('create-account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createDeveloperAccount(
    @Body() createDeveloperAccountDto: CreateDeveloperAccountDto,
  ) {
    return this.developerService.createDeveloperAccount(
      createDeveloperAccountDto,
    );
  }

  /**
   * @Accessible by developer
   * @description Developer requests to join a developer team
   * @returns Join request status
   */
  @Post('join-developer')
  @UseGuards(JwtAuthGuard)
  joinDeveloper(
    @CurrentUser('sub') userId: string,
    @Body() joinDeveloperDto: JoinDeveloperDto,
  ) {
    return this.developerService.joinDeveloper(joinDeveloperDto, {
      userId,
    });
  }

  /**
   * @Accessible by admin and superadmin
   * @description Superadmin can update developer profile
   * @returns Updated developer profile
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  update(
    @Param() params: MongoIdDto,
    @Body() updateDeveloperDto: UpdateDeveloperDto,
  ) {
    return this.developerService.updateDeveloper(params.id, updateDeveloperDto);
  }

  /**
   * @Accessible by developer
   * @description Developer can update their project script
   * @returns Updated developer script
   */
  @Patch(':id/project')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  updateDeveloperProject(
    @Param() params: MongoIdDto,
    @Body() updateDeveloperScriptDto: UpdateDeveloperScriptDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.developerService.updateDeveloperScript(
      userId,
      params.id,
      updateDeveloperScriptDto,
    );
  }

  /**
   * @Accessible by admin and superadmin
   * @description Delete developer
   * @returns Deleted developer
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  remove(@Param() params: MongoIdDto) {
    return this.developerService.remove(params.id);
  }

  /**
   * @Accessible by admin and superadmin
   * @description Links a user to a developer
   * @returns  linked user to developer
   */
  @Post(':developerId/link-user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  linkUserToDeveloper(
    @Param('developerId') developerId: string,
    @Param('userId') userId: string,
  ) {
    return this.developerService.linkUserToDeveloper(developerId, userId);
  }

  /**
   * @Accessible by admin and superadmin
   * @description Unlinks a user from a developer
   * @returns  unlinked user from developer
   */
  @Delete(':developerId/unlink-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  unlinkUserFromDeveloper(@Param('developerId') developerId: string) {
    return this.developerService.unlinkUserFromDeveloper(developerId);
  }
}
