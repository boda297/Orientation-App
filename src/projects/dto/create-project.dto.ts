import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
  IsUrl,
  IsArray,
  IsBoolean,
  IsDateString,
  Min,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateProjectDto {
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

  @IsMongoId()
  @IsOptional()
  @Type(() => Types.ObjectId)
  inventory?: any;

  // heroImage is uploaded via file upload (FileFieldsInterceptor), not in DTO body

  @IsMongoId()
  @IsOptional()
  @Type(() => Types.ObjectId)
  pdfUrl?: Types.ObjectId;

  @IsPhoneNumber()
  @IsOptional()
  whatsappNumber?: string;
}
