import { Module, forwardRef } from '@nestjs/common';
import { EpisodeService } from './episode.service';
import { EpisodeController } from './episode.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Episode, EpisodeSchema } from './entities/episode.entity';
import { ProjectsModule } from 'src/projects/projects.module';
import { S3Module } from 'src/s3/s3.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Episode.name, schema: EpisodeSchema }]),
    forwardRef(() => ProjectsModule),
    S3Module,
    SubscriptionModule,
  ],
  controllers: [EpisodeController],
  providers: [EpisodeService],
  exports: [EpisodeService],
})
export class EpisodeModule {}
