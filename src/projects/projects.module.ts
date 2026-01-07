import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './entities/project.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';
import { DeveloperModule } from 'src/developer/developer.module';
import { AuthModule } from 'src/auth/auth.module';
import { Developer, DeveloperSchema } from 'src/developer/entities/developer.entity';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Developer.name, schema: DeveloperSchema },
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
