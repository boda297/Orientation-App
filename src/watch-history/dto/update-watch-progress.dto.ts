import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class UpdateWatchProgressDto {
  @IsString()
  @IsNotEmpty()
  contentId: string;

  @IsString()
  @IsNotEmpty()
  contentTitle: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'contentThumbnail must be a valid URL' })
  contentThumbnail?: string;

  @IsNumber()
  @Min(0)
  currentTime: number;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  season?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  episode?: number;
}

