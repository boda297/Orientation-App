import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WatchHistory,
  WatchHistoryDocument,
} from './entities/watch-history.entity';
import { UpdateWatchProgressDto } from './dto/update-watch-progress.dto';

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectModel(WatchHistory.name)
    private readonly watchHistoryModel: Model<WatchHistoryDocument>,
  ) {}

  private calculateProgress(currentTime: number, duration: number): number {
    if (!duration || duration <= 0) return 0;
    const clamped = Math.min(Math.max(currentTime, 0), duration);
    const pct = Math.floor((clamped / duration) * 100);
    return Math.min(Math.max(pct, 0), 100);
  }

  async upsertProgress(userId: Types.ObjectId, dto: UpdateWatchProgressDto) {
    const currentTime = Math.min(Math.max(dto.currentTime, 0), dto.duration);
    const progressPercentage = this.calculateProgress(currentTime, dto.duration);
    const completed = progressPercentage >= 90;
    const lastWatchedAt = new Date();

    const watchHistory = await this.watchHistoryModel.findOneAndUpdate(
      { userId, contentId: dto.contentId },
      {
        userId,
        contentId: dto.contentId,
        contentTitle: dto.contentTitle,
        contentThumbnail: dto.contentThumbnail,
        currentTime,
        duration: dto.duration,
        progressPercentage,
        completed,
        lastWatchedAt,
        contentType: dto.contentType,
        season: dto.season,
        episode: dto.episode,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    return watchHistory;
  }

  async getContinueWatching(userId: Types.ObjectId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit || 10, 1), 100);

    const items = await this.watchHistoryModel
      .find({
        userId,
        completed: false,
        progressPercentage: { $gt: 0, $lt: 90 },
      })
      .sort({ lastWatchedAt: -1 })
      .limit(safeLimit);

    return { items, count: items.length };
  }

  async getAllHistory(
    userId: Types.ObjectId,
    includeCompleted = true,
    limit = 50,
  ) {
    const safeLimit = Math.min(Math.max(limit || 50, 1), 200);
    const filter: Record<string, unknown> = { userId };
    if (!includeCompleted) {
      filter.completed = false;
    }

    const items = await this.watchHistoryModel
      .find(filter)
      .sort({ lastWatchedAt: -1 })
      .limit(safeLimit);

    return { items, count: items.length };
  }

  async getRecent(userId: Types.ObjectId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit || 10, 1), 100);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const items = await this.watchHistoryModel
      .find({ userId, lastWatchedAt: { $gte: since } })
      .sort({ lastWatchedAt: -1 })
      .limit(safeLimit);

    return { items, count: items.length };
  }

  async getContentProgress(userId: Types.ObjectId, contentId: string) {
    return this.watchHistoryModel.findOne({ userId, contentId });
  }

  async markCompleted(userId: Types.ObjectId, contentId: string) {
    const watchHistory = await this.watchHistoryModel.findOne({ userId, contentId });
    if (!watchHistory) {
      throw new NotFoundException('Watch history not found for this content');
    }

    watchHistory.completed = true;
    watchHistory.progressPercentage = 100;
    if (typeof watchHistory.duration === 'number' && watchHistory.duration > 0) {
      watchHistory.currentTime = watchHistory.duration;
    }
    watchHistory.lastWatchedAt = new Date();

    await watchHistory.save();
    return watchHistory;
  }

  async removeContent(userId: Types.ObjectId, contentId: string) {
    const result = await this.watchHistoryModel.deleteOne({ userId, contentId });
    if (!result.deletedCount) {
      throw new NotFoundException('Watch history not found for this content');
    }
    return { deletedCount: result.deletedCount };
  }

  async clearAll(userId: Types.ObjectId) {
    const result = await this.watchHistoryModel.deleteMany({ userId });
    return { deletedCount: result.deletedCount || 0 };
  }
}

