import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeveloperService } from './developer.service';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperController } from './developer.controller';
import { Developer, DeveloperSchema } from './entities/developer.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';
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
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Developer.name, schema: DeveloperSchema },
      { name: User.name, schema: UserSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Episode.name, schema: EpisodeSchema },
      { name: Reel.name, schema: ReelSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: File.name, schema: FileSchema },
    ]),
    AuthModule,
    S3Module,
    EmailModule,
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService, DeveloperAuthService],
  exports: [DeveloperService, DeveloperAuthService],
})
export class DeveloperModule {}
