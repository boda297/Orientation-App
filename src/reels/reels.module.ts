import { Module, forwardRef } from '@nestjs/common';
import { ReelsService } from './reels.service';
import { ReelsController } from './reels.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Reel, ReelSchema } from './entities/reel.entity';
import { S3Module } from 'src/s3/s3.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { DeveloperModule } from 'src/developer/developer.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reel.name, schema: ReelSchema },
    ]),
    forwardRef(() => ProjectsModule),
    DeveloperModule,
    UsersModule,
    S3Module,
  ],
  controllers: [ReelsController],
  providers: [ReelsService],
  exports: [ReelsService],
})
export class ReelsModule {}
