import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private bucketName: string;
  private cloudFrontUrl: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    const cloudFrontUrl = this.configService.get<string>('CLOUDFRONT_URL');

    if (!region) {
      throw new Error('AWS_REGION environment variable is required');
    }
    if (!accessKeyId) {
      throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
    }
    if (!secretAccessKey) {
      throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
    }
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    }
    if (!cloudFrontUrl) {
      throw new Error('CLOUDFRONT_URL environment variable is required');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucketName = bucketName;
    this.cloudFrontUrl = cloudFrontUrl;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: 'episodes' | 'reels' | 'images' | 'PDF',
  ): Promise<{ key: string; url: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          ServerSideEncryption: 'AES256',
        },
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB parts
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percentComplete = Math.round(
            (progress.loaded / progress.total) * 100,
          );
          this.logger.debug(`Upload Progress: ${percentComplete}%`);
        }
      });

      await upload.done();

      return {
        key: fileName,
        url: `${this.cloudFrontUrl}/${fileName}`,
      };
    } catch (error) {
      this.logger.error('Error uploading file to S3', error);
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error('Error deleting file from S3', error);
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  getCloudFrontUrl(key: string): string {
    return `${this.cloudFrontUrl}/${key}`;
  }
}
