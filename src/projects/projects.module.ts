import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './entities/project.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';
import { DeveloperModule } from 'src/developer/developer.module';
import { AuthModule } from 'src/auth/auth.module';
import {
  Developer,
  DeveloperSchema,
} from 'src/developer/entities/developer.entity';
import { S3Module } from 'src/s3/s3.module';
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
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Developer.name, schema: DeveloperSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: Reel.name, schema: ReelSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: File.name, schema: FileSchema },
    ]),
    DeveloperModule,
    AuthModule,
    S3Module,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
