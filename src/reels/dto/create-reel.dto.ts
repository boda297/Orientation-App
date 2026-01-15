import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsMongoId,
  IsUrl,
  IsString,
  IsOptional,
} from 'class-validator';
import { Types } from 'mongoose';

export class CreateReelDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsNotEmpty()
  @IsMongoId()
  @Type(() => Types.ObjectId)
  projectId: Types.ObjectId;

}
