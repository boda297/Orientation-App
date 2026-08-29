import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateWatchProgressDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  projectTitle: string;

  @IsString()
  @IsNotEmpty()
  contentId: string;

  @IsString()
  @IsNotEmpty()
  contentTitle: string;

  @IsOptional()
  @IsString()
  contentThumbnail?: string;

  @IsOptional()
  @IsString()
  episodeUrl?: string;

  @IsNumber()
  @Min(0)
  currentTime: number;

  @IsNumber()
  @Min(0)
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

