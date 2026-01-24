import { IsOptional, IsString } from 'class-validator';

export class UpdateInventoryDto {
  @IsOptional()
  @IsString()
  title?: string;
}
