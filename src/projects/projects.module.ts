import { Module, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './entities/project.entity';
import { DeveloperModule } from 'src/developer/developer.module';
import { UsersModule } from 'src/users/users.module';
import { EpisodeModule } from 'src/episode/episode.module';
import { ReelsModule } from 'src/reels/reels.module';
import { FilesModule } from 'src/files/files.module';
import { AuthModule } from 'src/auth/auth.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
    ]),
    DeveloperModule,
    UsersModule,
    forwardRef(() => EpisodeModule),
    forwardRef(() => ReelsModule),
    FilesModule,
    AuthModule,
    S3Module,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
