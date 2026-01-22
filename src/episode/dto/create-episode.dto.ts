import { Type } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class CreateEpisodeDto {
  @IsNotEmpty()
  @IsMongoId()
  @Type(() => Types.ObjectId)
  projectId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  episodeOrder: string;

  @IsString()
  @IsNotEmpty()
  duration: string;
}
