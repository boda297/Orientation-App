import { IsMongoId, IsNotEmpty } from 'class-validator';

export class SubscribeDto {
  @IsMongoId()
  @IsNotEmpty()
  planId: string;
}
