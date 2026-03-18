import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CartStatus } from '../../../common/enums';

/**
 * Add Item to Cart DTO
 */
export class AddCartItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

/**
 * Update Cart Item DTO
 */
export class UpdateCartItemDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

/**
 * Apply Promotion DTO
 */
export class ApplyPromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  promoCode: string;
}

/**
 * Checkout DTO
 */
export class CheckoutDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shippingAddressId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  promotionCode?: string;
}

/**
 * Cart Item Response DTO
 */
export class CartItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cartId: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  product: any;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalPrice: number;
}

/**
 * Cart Response DTO
 */
export class CartResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: CartStatus })
  status: CartStatus;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Checkout Response DTO
 */
export class CheckoutResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  message: string;
}
