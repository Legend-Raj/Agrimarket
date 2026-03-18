import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  Min,
  Max,
  MaxLength,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProductStatus } from '../../../common/enums';

/**
 * Create Product Category DTO
 */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Fertilizers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'fertilizers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ example: 'All types of fertilizers for crops' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/fertilizers.jpg' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

/**
 * Update Category DTO
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

/**
 * Create Product DTO
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Organic Nitrogen Fertilizer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'High-quality organic nitrogen fertilizer for wheat and corn' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 149.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumQuantity?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryRadius?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'ORG-N-001' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ example: 'kg' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/product.jpg' })
  @IsUrl()
  @IsOptional()
  primaryImageUrl?: string;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}

/**
 * Update Product DTO
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}

/**
 * Filter Products Query DTO
 *
 * Supports multi-select filtering:
 * - categoryIds: Comma-separated list of category IDs (OR logic within)
 * - sellerIds: Comma-separated list of seller IDs (OR logic within)
 * - Different filter types combine with AND logic
 */
export class FilterProductsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated category IDs for multi-select (OR logic)' })
  @IsString()
  @IsOptional()
  categoryIds?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated seller IDs for multi-select (OR logic)' })
  @IsString()
  @IsOptional()
  sellerIds?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;
}

/**
 * Product Response DTO
 * Mapped for frontend compatibility
 * Includes BOTH price and pointsCost so existing frontend code works
 * regardless of which field name it expects.
 */
export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  price: number;  // Primary price field - matches frontend Product interface

  @ApiProperty()
  pointsCost: number;  // Alias for price (kept for backward compat)

  @ApiProperty()
  currency: string;

  @ApiProperty()
  minimumQuantity: number;

  @ApiProperty()
  deliveryRadius: number;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiPropertyOptional()
  sku?: string;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  category?: any;

  @ApiProperty()
  sellerId: string;

  @ApiPropertyOptional()
  seller?: any;

  @ApiProperty()
  unit?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  stock: number | null;  // From inventory

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Filter options response DTO for dynamic filter sidebar
 */
export class FilterOptionsDto {
  @ApiProperty({ type: [String] })
  categories: { id: string; name: string; slug: string; productCount: number }[];

  @ApiProperty()
  priceRange: { min: number; max: number };

  @ApiProperty({ type: [String] })
  sellers: { id: string; companyName: string | null; productCount: number }[];

  @ApiProperty()
  totalProducts: number;
}

/**
 * Paginated Products Response
 */
export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data: ProductResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
