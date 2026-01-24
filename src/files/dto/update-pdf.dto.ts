import { IsOptional, IsString } from 'class-validator';

export class UpdatePdfDto {
  @IsOptional()
  @IsString()
  title?: string;
}
