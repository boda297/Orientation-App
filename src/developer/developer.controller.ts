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
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { UpdateDeveloperScriptDto } from './dto/update-developer-project.dto';
import { JoinDeveloperDto } from './dto/join-developer.dto';
import { CreateDeveloperAccountDto } from './dto/create-developer-account.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findAll() {
    return this.developerService.findAllDevelopers();
  }

  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  getMyProfile(@CurrentUser('sub') userId: string) {
    return this.developerService.getMyProfile(userId);
  }

  @Get('me/projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  getMyProjects(@CurrentUser('sub') userId: string) {
    return this.developerService.getMyProjects(userId);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER)
  updateMyProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateDeveloperDto: UpdateDeveloperDto,
  ) {
    return this.developerService.updateMyProfile(userId, updateDeveloperDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.developerService.findOneDeveloper(params.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  create(@Body() createDeveloperDto: CreateDeveloperDto) {
    return this.developerService.createDeveloper(createDeveloperDto);
  }

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

  @Post('join-developer')
  @UseGuards(JwtAuthGuard)
  joinDeveloper(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() joinDeveloperDto: JoinDeveloperDto,
  ) {
    return this.developerService.joinDeveloper(joinDeveloperDto, {
      userId,
      userEmail,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  update(
    @Param() params: MongoIdDto,
    @Body() updateDeveloperDto: UpdateDeveloperDto,
  ) {
    return this.developerService.updateDeveloper(params.id, updateDeveloperDto);
  }

  // update developer project script
  @Patch(':id/project')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN, Role.SUPERADMIN)
  updateDeveloperProject(
    @Param() params: MongoIdDto,
    @Body() updateDeveloperScriptDto: UpdateDeveloperScriptDto,
  ) {
    return this.developerService.updateDeveloperScript(
      params.id,
      updateDeveloperScriptDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  remove(@Param() params: MongoIdDto) {
    return this.developerService.remove(params.id);
  }

  @Post(':developerId/link-user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  linkUserToDeveloper(
    @Param('developerId') developerId: string,
    @Param('userId') userId: string,
  ) {
    return this.developerService.linkUserToDeveloper(developerId, userId);
  }

  @Delete(':developerId/unlink-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  unlinkUserFromDeveloper(@Param('developerId') developerId: string) {
    return this.developerService.unlinkUserFromDeveloper(developerId);
  }
}
