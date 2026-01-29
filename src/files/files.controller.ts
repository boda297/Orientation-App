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
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdatePdfDto } from './dto/update-pdf.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { RolesGuard } from 'src/roles/roles.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   *  Inevtory Module Routes
   */

  @Post('upload/inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('inventory'))
  uploadFile(
    @Body() createInventoryDto: CreateInventoryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadInventory(createInventoryDto, file);
  }

  @Get('inventory')
  getInventory() {
    return this.filesService.getInventory();
  }

  @Delete('inventory/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  deleteFile(@Param() params: MongoIdDto) {
    return this.filesService.deleteInventory(params.id);
  }

  @Get('inventory/:id')
  @UseGuards(JwtAuthGuard)
  getInventoryById(@Param() params: MongoIdDto) {
    return this.filesService.getInventoryById(params.id);
  }

  @Patch('inventory/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('inventory'))
  updateInventory(
    @Param() params: MongoIdDto,
    @Body() updateInventoryDto: UpdateInventoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.filesService.updateInventory(params.id, updateInventoryDto, file);
  }
  



  /**
   * PDF Module Routes
  */
  @Post('upload/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('PDF'))
  uploadPDF(
    @Body() createPdfDto: CreatePdfDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadPDF(createPdfDto, file ? [file] : []);
  }

  @Get('pdf')
  getPDF() {
    return this.filesService.getPDF();
  }

  @Get('pdf/:id')
  @UseGuards(JwtAuthGuard)
  getPDFById(@Param() params: MongoIdDto) {
    return this.filesService.getPDFById(params.id);
  }


  @Patch('pdf/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('PDF'))
  updatePDF(
    @Param() params: MongoIdDto,
    @Body() updatePdfDto: UpdatePdfDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.filesService.updatePDF(params.id, updatePdfDto, file);
  }


  @Delete('pdf/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  deletePDF(@Param() params: MongoIdDto) {
    return this.filesService.deletePDF(params.id);
  }
}
