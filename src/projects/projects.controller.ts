import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { Types } from 'mongoose';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'heroVideo', maxCount: 1 },
        { name: 'projectThumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 1000 * 1024 * 1024, // 1GB max per file
        },
      },
    ),
  )
  createProject(
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      heroVideo?: Express.Multer.File[];
      projectThumbnail?: Express.Multer.File[];
    },
  ) {
    return this.projectsService.create(
      createProjectDto,
      files?.logo?.[0],
      files?.heroVideo?.[0],
      files?.projectThumbnail?.[0],
    );
  }

  @Get()
  findAllProjects(@Query() queryProjectDto: QueryProjectDto) {
    return this.projectsService.findAll(queryProjectDto);
  }

  @Get('trending')
  findTrendingProjects(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.projectsService.findTrending(limitNum);
  }

  @Get(':id')
  findOneProject(@Param() params: MongoIdDto) {
    return this.projectsService.findOne(params.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'heroVideo', maxCount: 1 },
        { name: 'projectThumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 1000 * 1024 * 1024, // 1GB max per file
        },
      },
    ),
  )
  updateProject(
    @Param() params: MongoIdDto,
    @Body() updateProjectDto: UpdateProjectDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      heroVideo?: Express.Multer.File[];
      projectThumbnail?: Express.Multer.File[];
    },
  ) {
    return this.projectsService.update(
      params.id,
      updateProjectDto,
      files?.logo?.[0],
      files?.heroVideo?.[0],
      files?.projectThumbnail?.[0],
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  removeProject(@Param() params: MongoIdDto) {
    return this.projectsService.remove(params.id);
  }

  @Patch(':id/increment-view')
  @UseGuards(AuthGuard)
  incrementViewCount(@Param() params: MongoIdDto) {
    return this.projectsService.incrementViewCount(params.id);
  }

  @Patch(':id/save-project')
  @UseGuards(AuthGuard)
  saveProject(@Param() params: MongoIdDto, @Request() req: any) {
    const userId = new Types.ObjectId(req.user.sub);
    return this.projectsService.saveProject(params.id, userId);
  }

  @Patch(':id/unsave-project')
  @UseGuards(AuthGuard)
  unsaveProject(@Param() params: MongoIdDto, @Request() req: any) {
    const userId = new Types.ObjectId(req.user.sub);
    return this.projectsService.unsaveProject(params.id, userId);
  }

  // @Put(':id/increment-share')
  // @UseGuards(AuthGuard)
  // incrementShareCount(@Param() params: MongoIdDto) {
  // return this.projectsService.incrementShareCount(params.id);
  // }

  @Put(':id/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  publishProject(@Param() params: MongoIdDto) {
    return this.projectsService.publish(params.id);
  }

  @Put(':id/unpublish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  unpublishProject(@Param() params: MongoIdDto) {
    return this.projectsService.unpublish(params.id);
  }
}
