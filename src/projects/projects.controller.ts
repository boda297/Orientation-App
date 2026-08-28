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
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { Types } from 'mongoose';
import { QueryProjectDto } from './dto/query-project.dto';
import { CreateUpcommingProjectDto } from './dto/create-upcomming-project.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Create a new project
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Create a new upcomming project
  @Post('upcomming')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'projectThumbnail', maxCount: 1 }], {
      limits: {
        fileSize: 1000 * 1024 * 1024, // 1GB max per file
      },
    }),
  )
  createUpcommingProject(
    @Body() createUpcommingProjectDto: CreateUpcommingProjectDto,
    @UploadedFiles()
    files: {
      projectThumbnail?: Express.Multer.File[];
    },
  ) {
    return this.projectsService.createUpcommingProject(
      createUpcommingProjectDto,
      files?.projectThumbnail?.[0],
    );
  }

  // @Accessible by All
  // @Description Get all projects
  @Public()
  @Get()
  findAllProjects(@Query() queryProjectDto: QueryProjectDto) {
    return this.projectsService.findAll(queryProjectDto);
  }

  // @Accessible by All
  // @Description Get all featured projects
  @Public()
  @Get('featured')
  findFeaturedProjects(@Query('limit') limit?: string) {
    // max 3 projects
    const limitNum = limit ? parseInt(limit, 10) : 3;
    return this.projectsService.findFeatured(limitNum);
  }

  // @Accessible by All
  // @Description Get all latest projects
  @Public()
  @Get('latest')
  findLatestProjects(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.projectsService.findLatest(limitNum);
  }

  // @Accessible by All
  // @Description Get all upcoming projects
  @Public()
  @Get('upcoming')
  findUpcomingProjects(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.projectsService.findUpcoming(limitNum);
  }

  // @Accessible by All
  // @Description Get top 10 projects
  @Public()
  @Get('top10')
  findTop10Projects(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.projectsService.findTrending(limitNum);
  }

  // @Accessible by All
  // @Description Get Projects by location
  @Public()
  @Get('location')
  findProjectByLocation(
    @Query('location') location: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.projectsService.findProjectByLocation(location, limitNum);
  }

  // @Accessible by All
  // @Description Get projects by status for admins dashboard
  @Get('status')
  findProjectByStatus(@Query('status') status: string) {
    return this.projectsService.findProjectByStatus(status);
  }

  // @Accessible by All
  // @Description Get projects by title for search
  @Get('title')
  findProjectByTitle(@Query('title') title: string) {
    return this.projectsService.findProjectByTitle(title);
  }

  // @Accessible by All
  // @Description Get projects by developer
  @Get('developer')
  findProjectByDeveloper(@Query('developer') developer: string) {
    return this.projectsService.findByDeveloper(developer);
  }

  // @Accessible by All (authenticated users get hasAccess=true for new content if subscribed)
  // @Description Get project by id
  @Public()
  @Get(':id')
  findOneProject(@Param() params: MongoIdDto, @Req() req: any) {
    const userId: string | undefined = req.user?.sub ?? req.user?.userId;
    return this.projectsService.findOne(params.id, userId);
  }

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Update project
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Delete project
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  removeProject(@Param() params: MongoIdDto) {
    return this.projectsService.remove(params.id);
  }

  // @Accessible by AUTHENTICATED USERS
  // @Description Save a project
  @Patch(':id/save-project')
  @UseGuards(JwtAuthGuard)
  saveProject(@Param() params: MongoIdDto, @Request() req: any) {
    const userId = new Types.ObjectId(req.user.sub);
    return this.projectsService.saveProject(params.id, userId);
  }

  // @Accessible by AUTHENTICATED USERS
  // @Description Unsave a project
  @Patch(':id/unsave-project')
  @UseGuards(JwtAuthGuard)
  unsaveProject(@Param() params: MongoIdDto, @Request() req: any) {
    const userId = new Types.ObjectId(req.user.sub);
    return this.projectsService.unsaveProject(params.id, userId);
  }

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Publish a project
  @Put(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  publishProject(@Param() params: MongoIdDto) {
    return this.projectsService.publish(params.id);
  }

  // @Accessible by ADMIN and SUPERADMIN
  // @Description Unpublish a project
  @Put(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  unpublishProject(@Param() params: MongoIdDto) {
    return this.projectsService.unpublish(params.id);
  }
}
