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
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';

import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('image'))
  createNews(
    @Body() createNewsDto: CreateNewsDto,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    return this.newsService.create(createNewsDto, thumbnail);
  }

  @Get()
  findAll() {
    return this.newsService.findAll();
  }

  @Get(':id')
  findOne(@Param() params: MongoIdDto) {
    return this.newsService.findOne(params.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param() params: MongoIdDto,
    @Body() updateNewsDto: UpdateNewsDto,
    @UploadedFile() thumbnail?: Express.Multer.File,
  ) {
    return this.newsService.update(params.id, updateNewsDto, thumbnail);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async remove(@Param() params: MongoIdDto) {
    return this.newsService.remove(params.id);
  }
}
