import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  /** Base price in piastres BEFORE VAT — e.g. 9000 = 90 EGP */
  @IsNumber()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsString()
  currency?: string;

  /** VAT rate in percent — defaults to 14 (Egyptian VAT) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatPercent?: number;

  /** Duration in days — e.g. 90 for 3 months, 180 for 6 months */
  @IsNumber()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Unique order index for display sorting in frontend */
  @IsNumber()
  @Min(1)
  sortOrder: number;
}
