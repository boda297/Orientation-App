import { IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
