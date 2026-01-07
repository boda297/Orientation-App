import { Module } from '@nestjs/common';
import { EpisodeService } from './episode.service';
import { EpisodeController } from './episode.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Episode, EpisodeSchema } from './entities/episode.entity';
import { Project, ProjectSchema } from 'src/projects/entities/project.entity';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [ MongooseModule.forFeature([{ name: Episode.name, schema: EpisodeSchema }]), MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]), S3Module],
  controllers: [EpisodeController],
  providers: [EpisodeService],
})
export class EpisodeModule {}
