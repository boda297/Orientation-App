import { Type } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateInventoryDto {
  @IsNotEmpty()
  @IsMongoId()
  @Type(() => Types.ObjectId)
  projectId: Types.ObjectId;

  @IsNotEmpty()
  @IsString()
  title: string;
}
