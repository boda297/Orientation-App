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
  @IsOptional()
  socialMediaLink?: string;

  @IsString()
  @IsNotEmpty()
  location: string;
}
