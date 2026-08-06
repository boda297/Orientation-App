import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';

@Controller('upload')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * POST /upload/inventory
   * Uploads an inventory document (Excel sheets, CSV, Google Slides / PowerPoint presentations, etc.) to AWS S3.
   * Allowed file types: xls, xlsx, xlsm, xlsb, csv, tsv, ods, ppt, pptx, odp, gslides, gsheet, pdf (Max size: 100MB).
   * Access: ADMIN, SUPERADMIN
   */
  @Post('inventory')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async uploadInventory(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
          new FileTypeValidator({
            fileType:
              /(xls|xlsx|xlsm|xlsb|gsheet|ms-excel|openxmlformats|spreadsheet)/i,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const validExtensions = ['xls', 'xlsx', 'xlsm', 'xlsb', 'gsheet'];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed extensions: ${validExtensions.join(', ')}`,
      );
    }

    const result = await this.s3Service.uploadFile(file, 'inventory');

    return {
      success: true,
      message: 'Inventory file uploaded successfully',
      data: result,
    };
  }

  /**
   * POST /upload/episode
   * Uploads an episode video file to AWS S3 in the 'episodes' folder.
   * Allowed file types: mp4, mov, avi, mkv (Max size: 500MB).
   * Access: ADMIN, SUPERADMIN
   */
  @Post('episode')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async uploadEpisode(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 500 * 1024 * 1024 }), // 500MB
          new FileTypeValidator({ fileType: /(mp4|mov|avi|mkv)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.s3Service.uploadFile(file, 'episodes');

    return {
      success: true,
      message: 'Episode uploaded successfully',
      data: result,
    };
  }

  /**
   * POST /upload/reel
   * Uploads a short video reel file to AWS S3 in the 'reels' folder.
   * Allowed file types: mp4, mov (Max size: 100MB).
   * Access: ADMIN, SUPERADMIN
   */
  @Post('reel')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async uploadReel(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
          new FileTypeValidator({ fileType: /(mp4|mov)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.s3Service.uploadFile(file, 'reels');

    return {
      success: true,
      message: 'Reel uploaded successfully',
      data: result,
    };
  }

  /**
   * POST /upload/image
   * Uploads an image file to AWS S3 in the 'images' folder.
   * Allowed file types: jpg, jpeg, png, webp (Max size: 10MB).
   * Access: ADMIN, SUPERADMIN
   */
  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.s3Service.uploadFile(file, 'images');

    return {
      success: true,
      message: 'Image uploaded successfully',
      data: result,
    };
  }

  /**
   * POST /upload/pdf
   * Uploads a PDF document to AWS S3 in the 'PDF' folder.
   * Allowed file types: pdf (Max size: 20MB).
   * Access: ADMIN, SUPERADMIN
   */
  @Post('pdf')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async uploadPDF(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }), // 20MB
          new FileTypeValidator({ fileType: 'pdf' }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.s3Service.uploadFile(file, 'PDF');

    return {
      success: true,
      message: 'PDF uploaded successfully',
      data: result,
    };
  }

  /**
   * DELETE /upload
   * Deletes a file from AWS S3.
   * @param key - The key of the file to delete.
   * Access: ADMIN, SUPERADMIN
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async deleteFile(@Body('key') key: string) {
    if (!key) {
      throw new BadRequestException('Key is required');
    }
    await this.s3Service.deleteFile(key);
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }
}
