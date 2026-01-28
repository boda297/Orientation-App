import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { WatchHistoryService } from './watch-history.service';
import { UpdateWatchProgressDto } from './dto/update-watch-progress.dto';

@Controller('watch-history')
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(private readonly watchHistoryService: WatchHistoryService) {}

  @Post('progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWatchProgressDto,
  ) {
    const watchHistory = await this.watchHistoryService.upsertProgress(
      new Types.ObjectId(userId),
      dto,
    );
    return { message: 'Watch progress updated successfully', watchHistory };
  }

  @Get('continue-watching')
  async getContinueWatching(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const { items, count } = await this.watchHistoryService.getContinueWatching(
      new Types.ObjectId(userId),
      limit ? parseInt(limit, 10) : 10,
    );
    return { message: 'Continue watching list fetched successfully', items, count };
  }

  @Get()
  async getAllHistory(
    @CurrentUser('sub') userId: string,
    @Query('includeCompleted') includeCompleted?: string,
    @Query('limit') limit?: string,
  ) {
    const include =
      includeCompleted === undefined ? true : includeCompleted === 'true';
    const { items, count } = await this.watchHistoryService.getAllHistory(
      new Types.ObjectId(userId),
      include,
      limit ? parseInt(limit, 10) : 50,
    );
    return { message: 'Watch history fetched successfully', items, count };
  }

  @Get('recent')
  async getRecent(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const { items, count } = await this.watchHistoryService.getRecent(
      new Types.ObjectId(userId),
      limit ? parseInt(limit, 10) : 10,
    );
    return { message: 'Recently watched content fetched successfully', items, count };
  }

  @Get('content/:contentId')
  async getContentProgress(
    @CurrentUser('sub') userId: string,
    @Param('contentId') contentId: string,
  ) {
    const watchHistory = await this.watchHistoryService.getContentProgress(
      new Types.ObjectId(userId),
      contentId,
    );
    return { message: 'Watch progress fetched successfully', watchHistory };
  }

  @Post('content/:contentId/complete')
  @HttpCode(HttpStatus.OK)
  async markCompleted(
    @CurrentUser('sub') userId: string,
    @Param('contentId') contentId: string,
  ) {
    const watchHistory = await this.watchHistoryService.markCompleted(
      new Types.ObjectId(userId),
      contentId,
    );
    return { message: 'Content marked as completed', watchHistory };
  }

  @Delete('content/:contentId')
  async removeFromHistory(
    @CurrentUser('sub') userId: string,
    @Param('contentId') contentId: string,
  ) {
    await this.watchHistoryService.removeContent(
      new Types.ObjectId(userId),
      contentId,
    );
    return { message: 'Content removed from watch history' };
  }

  @Delete('clear')
  async clearAll(@CurrentUser('sub') userId: string) {
    await this.watchHistoryService.clearAll(new Types.ObjectId(userId));
    return { message: 'Watch history cleared successfully' };
  }
}

