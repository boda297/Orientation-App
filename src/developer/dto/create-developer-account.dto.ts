import {
  IsString,
  IsNotEmpty,
  IsMongoId,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateDeveloperAccountDto {
  @IsMongoId()
  @IsNotEmpty()
  developerId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character',
    },
  )
  password: string;
}
