import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateDeveloperDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  location?: string;
}
