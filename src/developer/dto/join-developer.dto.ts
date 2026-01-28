import {
    IsEmail,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUrl,
    Matches,
    MaxLength,
    Min,
    MinLength,
  } from 'class-validator';
  
  export class JoinDeveloperDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name: string;
  
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(200)
    address: string;
  
    @IsString()
    @IsNotEmpty()
    @IsPhoneNumber()
    phoneNumber: string;
  
    @IsNumber()
    @Min(0)
    numberOfProjects: number;
  
    @IsString()
    @IsNotEmpty()
    @IsUrl()
    socialmediaLink: string;
  
    @IsString()
    @IsOptional()
    @MaxLength(500)
    notes: string;
  }
  