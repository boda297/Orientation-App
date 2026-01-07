import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateEpisodeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsString()
  @IsOptional()
  episodeUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  episodeOrder?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  duration?: number;
}
