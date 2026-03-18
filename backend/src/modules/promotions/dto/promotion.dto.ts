import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DiscountType } from '../entities/promotion.entity';

/**
 * Create Promotion DTO
 */
export class CreatePromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Summer Sale' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ example: '20% off for summer season' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  @IsNotEmpty()
  discountType: DiscountType;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  discountValue: number;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumOrderAmount?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maximumDiscount?: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  @IsNotEmpty()
  endDate: Date;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sellerId?: string;
}

/**
 * Update Promotion DTO
 */
export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Validate Promotion DTO
 */
export class ValidatePromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 150 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  orderAmount?: number;
}

/**
 * Apply Promotion DTO
 */
export class ApplyPromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0)
  orderAmount: number;
}

/**
 * Create Bundle DTO
 */
export class CreateBundleDto {
  @ApiProperty({ example: 'Spring Planting Bundle' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Complete package for spring planting season' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ example: 299.99 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  bundlePrice: number;

  @ApiProperty({ type: [String] })
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  productIds: string[];

  @ApiPropertyOptional({ example: 'https://example.com/bundle.jpg' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update Bundle DTO
 */
export class UpdateBundleDto extends PartialType(CreateBundleDto) {}

/**
 * Promotion Response DTO
 */
export class PromotionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: DiscountType })
  discountType: DiscountType;

  @ApiProperty()
  discountValue: number;

  @ApiPropertyOptional()
  minimumOrderAmount?: number;

  @ApiPropertyOptional()
  maximumDiscount?: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  usageLimit: number;

  @ApiProperty()
  usageCount: number;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  sellerId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Bundle Response DTO
 */
export class BundleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  bundlePrice: number;

  @ApiProperty()
  productIds: string[];

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Validation Result DTO
 */
export class ValidationResultDto {
  @ApiProperty()
  valid: boolean;

  @ApiPropertyOptional()
  discount?: number;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  promotion?: PromotionResponseDto;
}
