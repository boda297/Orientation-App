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
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EpisodeService } from './episode.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { MongoIdDto } from '../common/mongoId.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('episode')
@UseGuards(AuthGuard)
export class EpisodeController {
  constructor(private readonly episodeService: EpisodeService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
      },
    }),
  )
  async uploadEpisode(
    @UploadedFile() file: Express.Multer.File,
    @Body() createEpisodeDto: CreateEpisodeDto,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.episodeService.uploadEpisode(
      createEpisodeDto,
      file,
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
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async update(
    @Param() params: MongoIdDto,
    @Body() updateEpisodeDto: UpdateEpisodeDto,
  ) {
    return this.episodeService.update(params.id, updateEpisodeDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async remove(@Param() params: MongoIdDto) {
    return this.episodeService.remove(params.id);
  }
}
