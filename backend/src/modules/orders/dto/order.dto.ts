import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../../common/enums';

/**
 * Update Order Status DTO
 */
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;
}

/**
 * Cancel Order DTO
 */
export class CancelOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Update Tracking DTO
 */
export class UpdateTrackingDto {
  @ApiProperty({ example: 'UPS' })
  @IsString()
  @IsNotEmpty()
  carrier: string;

  @ApiProperty({ example: '1Z999AA10123456784' })
  @IsString()
  @IsNotEmpty()
  trackingNumber: string;
}

/**
 * Order Item Response DTO
 */
export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

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
 * Order Status History DTO
 */
export class OrderStatusHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ enum: OrderStatus })
  fromStatus: OrderStatus;

  @ApiProperty({ enum: OrderStatus })
  toStatus: OrderStatus;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  createdAt: Date;
}

/**
 * Order Tracking DTO
 */
export class OrderTrackingDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  carrier: string;

  @ApiProperty()
  trackingNumber: string;

  @ApiPropertyOptional()
  estimatedDelivery?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Order Response DTO
 */
export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  buyerId: string;

  @ApiProperty()
  buyer: any;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  seller: any;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  tax: number;

  @ApiProperty()
  shippingCost: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiPropertyOptional()
  shippingAddressId?: string;

  @ApiPropertyOptional()
  shippingAddress?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiPropertyOptional()
  statusHistory?: OrderStatusHistoryDto[];

  @ApiPropertyOptional()
  tracking?: OrderTrackingDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Create Order from Cart DTO
 */
export class CreateOrderFromCartDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  sellerId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  shippingAddressId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Paginated Orders DTO
 */
export class PaginatedOrdersDto {
  @ApiProperty({ type: [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
