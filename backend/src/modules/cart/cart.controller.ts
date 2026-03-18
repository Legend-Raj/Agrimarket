import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  ApplyPromotionDto,
  CheckoutDto,
  CartResponseDto,
  CheckoutResponseDto,
} from './dto/cart.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  /**
   * Get current user's cart
   */
  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  async getCart(@CurrentUser() user: User): Promise<CartResponseDto> {
    return this.cartService.getMyCart(user.id);
  }

  /**
   * Get cart item count
   */
  @Get('count')
  @ApiOperation({ summary: 'Get cart item count' })
  @ApiResponse({ status: 200, description: 'Item count retrieved' })
  async getCartCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.cartService.getCartItemCount(user.id);
    return { count };
  }

  /**
   * Add item to cart
   */
  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @ApiResponse({ status: 400, description: 'Invalid quantity or product' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async addItem(
    @CurrentUser() user: User,
    @Body() addCartItemDto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(user.id, addCartItemDto);
  }

  /**
   * Update cart item quantity
   */
  @Put('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Item quantity updated' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async updateItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(user.id, itemId, updateCartItemDto);
  }

  /**
   * Remove item from cart
   */
  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 204, description: 'Item removed from cart' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async removeItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    await this.cartService.removeItem(user.id, itemId);
  }

  /**
   * Clear cart
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 204, description: 'Cart cleared' })
  async clearCart(@CurrentUser() user: User): Promise<void> {
    await this.cartService.clearCart(user.id);
  }

  /**
   * Apply promotion code
   */
  @Post('promotion')
  @ApiOperation({ summary: 'Apply promotion code to cart' })
  @ApiBody({ type: ApplyPromotionDto })
  @ApiResponse({ status: 200, description: 'Promotion applied' })
  @ApiResponse({ status: 400, description: 'Invalid promotion code' })
  async applyPromotion(
    @CurrentUser() user: User,
    @Body() applyPromotionDto: ApplyPromotionDto,
  ): Promise<CartResponseDto> {
    return this.cartService.applyPromotion(user.id, applyPromotionDto);
  }

  /**
   * Checkout - Create order from cart
   */
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Checkout - Create order from cart' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Cart is empty or invalid' })
  async checkout(
    @CurrentUser() user: User,
    @Body() checkoutDto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.cartService.checkout(user.id, checkoutDto);
  }
}
