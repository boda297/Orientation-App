import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileSchema } from './entities/file.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { Inventory, InventorySchema } from './entities/inventory.entity';
import { Project, ProjectSchema } from 'src/projects/entities/project.entity';
import {
  Developer,
  DeveloperSchema,
} from 'src/developer/entities/developer.entity';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: File.name, schema: FileSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Developer.name, schema: DeveloperSchema },
    ]),
    S3Module,
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
