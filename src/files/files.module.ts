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
import { FILE_SIGNATURE_INSPECTOR } from 'src/common/interfaces/file-signature-inspector.interface';
import { FileTypeSignatureAdapter } from 'src/common/adapters/file-type-signature.adapter';
import {
  PdfMagicByteValidationPipe,
  InventoryMagicByteValidationPipe,
} from 'src/common/pipes/magic-byte-validation.pipe';

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
  providers: [
    FilesService,
    {
      // Bind the interface symbol to the concrete implementation for magic byte validation
      provide: FILE_SIGNATURE_INSPECTOR,
      useClass: FileTypeSignatureAdapter,
    },
    PdfMagicByteValidationPipe,
    InventoryMagicByteValidationPipe,
  ],
  exports: [
    FILE_SIGNATURE_INSPECTOR,
    PdfMagicByteValidationPipe,
    InventoryMagicByteValidationPipe,
  ],
})
export class FilesModule {}
