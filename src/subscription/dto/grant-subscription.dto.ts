import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class GrantSubscriptionDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsMongoId()
  @IsNotEmpty()
  planId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
