import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { RolesGuard } from 'src/roles/roles.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload/inventory')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('inventory'))
  uploadFile(
    @Body() createInventoryDto: CreateInventoryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadInventory(createInventoryDto, file);
  }

  @Post('upload/pdf')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('PDF'))
  uploadPDF(
    @Body() createPdfDto: CreatePdfDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.filesService.uploadPDF(createPdfDto, files);
  }

  @Get('get/inventory')
  @UseGuards(AuthGuard)
  getInventory() {
    return this.filesService.getInventory();
  }

  @Get('get/inventory/:id')
  @UseGuards(AuthGuard)
  getInventoryById(@Param() params: MongoIdDto) {
    return this.filesService.getInventoryById(params.id);
  }

  @Get('get/pdf')
  @UseGuards(AuthGuard)
  getPDF() {
    return this.filesService.getPDF();
  }

  @Get('get/pdf/:id')
  @UseGuards(AuthGuard)
  getPDFById(@Param() params: MongoIdDto) {
    return this.filesService.getPDFById(params.id);
  }

  @Delete('delete/inventory/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  deleteFile(@Param() params: MongoIdDto) {
    return this.filesService.deleteInventory(params.id);
  }

  @Delete('delete/pdf/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  deletePDF(@Param() params: MongoIdDto) {
    return this.filesService.deletePDF(params.id);
  }
}
