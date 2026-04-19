import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsBoolean,
  IsPhoneNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateProjectDto {
  @IsOptional()
  heroVideo?: Express.Multer.File; // Can be a video or image

  @IsOptional()
  logo?: Express.Multer.File;

  @IsOptional()
  projectThumbnail?: Express.Multer.File;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsMongoId()
  @IsNotEmpty()
  @Type(() => Types.ObjectId)
  developer: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  location: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsString()
  @IsOptional()
  mapsLocation?: string;

  @IsEnum(['PLANNING', 'CONSTRUCTION', 'COMPLETED', 'DELIVERED'])
  @IsOptional()
  status?: 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED';

  @IsString()
  @IsNotEmpty()
  script: string;

  @IsOptional()
  episodes?: any;

  @IsOptional()
  reels?: any;

  @IsOptional()
  inventory: Express.Multer.File;

  @IsOptional()
  pdf?: Express.Multer.File[];

  @IsPhoneNumber()
  @IsOptional()
  whatsappNumber?: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
