import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  ApplyPromotionDto,
  CheckoutDto,
  CartResponseDto,
  CheckoutResponseDto,
} from './dto/cart.dto';
import { CartStatus } from '../../common/enums';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    private dataSource: DataSource,
  ) {}

  /**
   * Get or create active cart for user
   */
  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { userId, status: CartStatus.ACTIVE },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      cart = this.cartRepository.create({
        userId,
        status: CartStatus.ACTIVE,
        total: 0,
      });
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  /**
   * Get cart by ID
   */
  async getCartById(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ['items', 'items.product', 'items.product.category'],
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  /**
   * Get current user's cart
   */
  async getMyCart(userId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    return this.formatCartResponse(cart);
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string,
    addCartItemDto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    const { productId, quantity } = addCartItemDto;

    // Verify product exists and is active
    const product = await this.productRepository.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found or unavailable');
    }

    // Check if user is buying their own product
    if (product.sellerId === userId) {
      throw new BadRequestException('You cannot add your own product to cart');
    }

    // Check minimum quantity
    if (quantity < product.minimumQuantity) {
      throw new BadRequestException(
        `Minimum quantity required is ${product.minimumQuantity}`,
      );
    }

    // Check inventory availability
    try {
      const inventory = await this.inventoryRepository.findOne({
        where: { productId },
      });

      if (inventory && inventory.availableQuantity < quantity) {
        throw new BadRequestException(
          `Only ${inventory.availableQuantity} items available in stock`,
        );
      }
    } catch (e) {
      // If inventory doesn't exist, allow adding (inventory might not be tracked)
      if (e instanceof BadRequestException) throw e;
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Check if item already in cart
    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId },
    });

    if (cartItem) {
      // Update quantity
      cartItem.quantity += quantity;
      cartItem.totalPrice = cartItem.quantity * cartItem.unitPrice;
      await this.cartItemRepository.save(cartItem);
      this.logger.log(`Updated cart item: ${cartItem.id}`);
    } else {
      // Create new cart item
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
      });
      await this.cartItemRepository.save(cartItem);
      this.logger.log(`Added new cart item: ${cartItem.id}`);
    }

    // Recalculate cart total
    await this.recalculateCartTotal(cart.id);

    // Reload cart with items
    const updatedCart = await this.getCartById(cart.id);
    return this.formatCartResponse(updatedCart);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    userId: string,
    itemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const newQuantity = updateCartItemDto.quantity;

    // Check minimum quantity
    if (newQuantity < cartItem.product.minimumQuantity) {
      throw new BadRequestException(
        `Minimum quantity required is ${cartItem.product.minimumQuantity}`,
      );
    }

    // Check inventory
    try {
      const inventory = await this.inventoryRepository.findOne({
        where: { productId: cartItem.productId },
      });

      if (inventory && inventory.availableQuantity < newQuantity) {
        throw new BadRequestException(
          `Only ${inventory.availableQuantity} items available in stock`,
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }

    // Calculate new total price
    cartItem.quantity = newQuantity;
    cartItem.totalPrice = newQuantity * cartItem.unitPrice;

    await this.cartItemRepository.save(cartItem);

    // Recalculate cart total
    await this.recalculateCartTotal(cart.id);

    // Reload and return
    const updatedCart = await this.getCartById(cart.id);
    return this.formatCartResponse(updatedCart);
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);

    // Recalculate cart total
    await this.recalculateCartTotal(cart.id);

    // Reload and return
    const updatedCart = await this.getCartById(cart.id);
    return this.formatCartResponse(updatedCart);
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);

    await this.cartItemRepository.delete({ cartId: cart.id });

    cart.total = 0;
    await this.cartRepository.save(cart);

    this.logger.log(`Cart cleared for user: ${userId}`);
  }

  /**
   * Apply promotion code
   */
  async applyPromotion(
    userId: string,
    applyPromotionDto: ApplyPromotionDto,
  ): Promise<CartResponseDto> {
    // This would integrate with the promotions module
    // For now, we'll just return the cart as-is
    const cart = await this.getOrCreateCart(userId);
    return this.formatCartResponse(cart);
  }

  /**
   * Checkout - Create order from cart
   * Note: Actual order creation is handled by the OrdersService
   */
  async checkout(
    userId: string,
    checkoutDto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const cart = await this.getOrCreateCart(userId);

    // Load cart items
    const cartWithItems = await this.getCartById(cart.id);

    if (!cartWithItems.items || cartWithItems.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // For now, just mark the cart as checked out
    // The actual order creation will be handled via the orders endpoint directly
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Cart, cart.id, {
        status: CartStatus.CHECKED_OUT,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Checkout completed for user: ${userId}`);

      return {
        orderId: cart.id, // Placeholder - actual order creation via orders endpoint
        orderNumber: `CART-${cart.id.substring(0, 8).toUpperCase()}`,
        totalAmount: cart.total,
        message: 'Cart checked out. Use orders endpoint to create actual orders.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Recalculate cart total
   */
  private async recalculateCartTotal(cartId: string): Promise<void> {
    const result = await this.cartItemRepository
      .createQueryBuilder('item')
      .select('SUM(item.totalPrice)', 'total')
      .where('item.cartId = :cartId', { cartId })
      .getRawOne();

    const total = parseFloat(result?.total || '0');

    await this.cartRepository.update(cartId, { total });
  }

  /**
   * Format cart response
   */
  private formatCartResponse(cart: Cart): CartResponseDto {
    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      total: cart.total,
      items: cart.items || [],
      itemCount: cart.items?.length || 0,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  /**
   * Get cart item count
   */
  async getCartItemCount(userId: string): Promise<number> {
    const cart = await this.getOrCreateCart(userId);

    const result = await this.cartItemRepository
      .createQueryBuilder('item')
      .select('SUM(item.quantity)', 'count')
      .where('item.cartId = :cartId', { cartId: cart.id })
      .getRawOne();

    return parseInt(result?.count || '0', 10);
  }
}
