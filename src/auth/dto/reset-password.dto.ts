import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  newPassword: string;
}
