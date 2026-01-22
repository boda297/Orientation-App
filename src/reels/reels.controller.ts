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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ReelsService } from './reels.service';
import { CreateReelDto } from './dto/create-reel.dto';
import { UpdateReelDto } from './dto/update-reel.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Role } from 'src/roles/roles.enum';
import { Roles } from 'src/roles/roles.decorator';
import { MongoIdDto } from 'src/common/mongoId.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';

@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
        },
      },
    ),
  )
  uploadReel(
    @Body() createReelDto: CreateReelDto,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    if (!files.file || files.file.length === 0) {
      throw new BadRequestException('Video file is required');
    }
    if (!files.thumbnail || files.thumbnail.length === 0) {
      throw new BadRequestException('Thumbnail file is required');
    }
    return this.reelsService.uploadReel(
      createReelDto,
      files.file[0],
      files.thumbnail[0],
    );
  }

  @Get()
  findAllReel() {
    return this.reelsService.findAllReels();
  }

  @Get('saved')
  @UseGuards(AuthGuard)
  getSavedReelsByUser(@Req() req: any) {
    return this.reelsService.getSavedReelsByUser(req.user.sub);
  }

  @Get(':id')
  findOneReel(@Param() params: MongoIdDto) {
    return this.reelsService.findOneReel(params.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
        },
      },
    ),
  )
  updateReel(
    @Param() params: MongoIdDto,
    @Body() updateReelDto: UpdateReelDto,
    @UploadedFiles()
    files?: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    return this.reelsService.updateReel(
      params.id,
      updateReelDto,
      files?.file?.[0],
      files?.thumbnail?.[0],
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  removeReel(@Param() params: MongoIdDto) {
    return this.reelsService.removeReel(params.id);
  }

  @Post(':id/save')
  @UseGuards(AuthGuard)
  saveReel(@Param() params: MongoIdDto, @Req() req: any) {
    return this.reelsService.saveReel(params.id, req.user.sub);
  }

  @Post(':id/unsave')
  @UseGuards(AuthGuard)
  unsaveReel(@Param() params: MongoIdDto, @Req() req: any) {
    return this.reelsService.unsaveReel(params.id, req.user.sub);
  }
}
