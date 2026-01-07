import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';

@Controller('upload')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|pdf|mp4|mov|avi|mp3|wav)$/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: 'episodes' | 'reels' | 'images' | 'PDF',
  ) {
    // Default to 'images' if no folder specified
    const targetFolder = folder || 'images';

    // Validate folder
    const validFolders = ['episodes', 'reels', 'images', 'PDF'];
    if (!validFolders.includes(targetFolder)) {
      throw new BadRequestException(
        `Invalid folder. Must be one of: ${validFolders.join(', ')}`,
      );
    }

    const result = await this.s3Service.uploadFile(
      file,
      targetFolder as 'episodes' | 'reels' | 'images' | 'PDF',
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      data: result,
    };
  }

  @Post('episode')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
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

  @Post('reel')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
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

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
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

  @Post('pdf')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
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

  
}
