import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  MinLength,
  MaxLength,
  IsEmail,
} from 'class-validator';

export class CreateDeveloperAccountDto {
  @IsMongoId()
  @IsNotEmpty()
  developerId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  password: string;
}
