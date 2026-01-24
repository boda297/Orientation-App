import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { EpisodeService } from './episode.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { MongoIdDto } from '../common/mongoId.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('episode')
export class EpisodeController {
  constructor(private readonly episodeService: EpisodeService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'episodeFile', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
        },
      },
    ),
  )
  async uploadEpisode(
    @UploadedFiles()
    files: {
      episodeFile?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @Body() createEpisodeDto: CreateEpisodeDto,
    @Request() req,
  ) {
    if (!files?.episodeFile?.[0]) {
      throw new BadRequestException('Episode file is required');
    }

    return this.episodeService.uploadEpisode(
      createEpisodeDto,
      files.episodeFile[0],
      files.thumbnail?.[0],
      req.user.sub,
    );
  }

  @Get()
  async findAll() {
    return this.episodeService.findAll();
  }

  @Get(':id')
  async findOne(@Param() params: MongoIdDto) {
    return this.episodeService.findOne(params.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'episodeFile', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
        },
      },
    ),
  )
  async update(
    @Param() params: MongoIdDto,
    @Body() updateEpisodeDto: UpdateEpisodeDto,
    @UploadedFiles()
    files?: {
      episodeFile?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    return this.episodeService.update(
      params.id,
      updateEpisodeDto,
      files?.episodeFile?.[0],
      files?.thumbnail?.[0],
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard, AuthGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async remove(@Param() params: MongoIdDto) {
    return this.episodeService.remove(params.id);
  }
}
