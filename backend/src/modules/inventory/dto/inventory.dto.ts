import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/**
 * Create Inventory DTO
 */
export class CreateInventoryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderPoint?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  trackQuantity?: boolean;
}

/**
 * Update Inventory DTO
 */
export class UpdateInventoryDto {
  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderPoint?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  trackQuantity?: boolean;
}

/**
 * Adjust Inventory DTO (for stock adjustments)
 */
export class AdjustInventoryDto {
  @ApiProperty({ example: 10, description: 'Positive for adding, negative for removing' })
  @IsNumber()
  @IsNotEmpty()
  adjustment: number;

  @ApiPropertyOptional({ example: 'Restocking from supplier' })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Reserve Inventory DTO
 */
export class ReserveInventoryDto {
  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

/**
 * Inventory Response DTO
 */
export class InventoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  reservedQuantity: number;

  @ApiProperty()
  availableQuantity: number;

  @ApiPropertyOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  reorderPoint?: number;

  @ApiProperty()
  trackQuantity: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Low Stock Alert DTO
 */
export class LowStockAlertDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  currentQuantity: number;

  @ApiProperty()
  lowStockThreshold: number;

  @ApiProperty()
  availableQuantity: number;
}
