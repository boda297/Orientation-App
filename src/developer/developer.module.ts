import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeveloperService } from './developer.service';
import { DeveloperController } from './developer.controller';
import { Developer, DeveloperSchema } from './entities/developer.entity';
import { AuthModule } from 'src/auth/auth.module';
import { S3Module } from 'src/s3/s3.module';
import { Project, ProjectSchema } from 'src/projects/entities/project.entity';
import { Episode, EpisodeSchema } from 'src/episode/entities/episode.entity';
import { Reel, ReelSchema } from 'src/reels/entities/reel.entity';
import {
  Inventory,
  InventorySchema,
} from 'src/files/entities/inventory.entity';
import { File, FileSchema } from 'src/files/entities/file.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Developer.name, schema: DeveloperSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: Reel.name, schema: ReelSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: File.name, schema: FileSchema },
    ]),
    AuthModule,
    S3Module,
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService],
  exports: [DeveloperService],
})
export class DeveloperModule {}
