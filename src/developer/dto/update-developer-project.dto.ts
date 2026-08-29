import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDeveloperScriptDto {
  @IsString()
  @IsNotEmpty()
  script: string;
}
