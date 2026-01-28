import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WatchHistory,
  WatchHistorySchema,
} from './entities/watch-history.entity';
import { WatchHistoryService } from './watch-history.service';
import { WatchHistoryController } from './watch-history.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WatchHistory.name, schema: WatchHistorySchema },
    ]),
  ],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
  exports: [WatchHistoryService],
})
export class WatchHistoryModule {}

