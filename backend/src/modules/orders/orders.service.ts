import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderTracking } from './entities/order-tracking.entity';
import { Product } from '../products/entities/product.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { User } from '../users/entities/user.entity';
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  UpdateTrackingDto,
  OrderResponseDto,
  PaginatedOrdersDto,
} from './dto/order.dto';
import { OrderStatus, CartStatus } from '../../common/enums';
import { CartItem } from '../cart/entities/cart-item.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private statusHistoryRepository: Repository<OrderStatusHistory>,
    @InjectRepository(OrderTracking)
    private trackingRepository: Repository<OrderTracking>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create order from cart items
   */
  async createOrderFromCart(
    buyerId: string,
    sellerId: string,
    cartItems: CartItem[],
    checkoutData: any,
    queryRunner?: QueryRunner,
  ): Promise<Order> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    // Get seller
    const seller = await this.userRepository.findOne({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const item of cartItems) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal,
      });
    }

    // Create order
    const order = manager.create(Order, {
      orderNumber: this.generateOrderNumber(),
      buyerId,
      sellerId,
      status: OrderStatus.PENDING,
      subtotal,
      tax: 0, // Can be calculated based on location
      shippingCost: 0, // Can be calculated based on distance
      discount: 0,
      totalAmount: subtotal,
      shippingAddressId: checkoutData.shippingAddressId,
      notes: checkoutData.notes,
    });

    const savedOrder = await manager.save(order);

    // Create order items
    for (const item of orderItems) {
      const orderItem = manager.create(OrderItem, {
        ...item,
        orderId: savedOrder.id,
      });
      await manager.save(orderItem);

      // Reserve inventory
      try {
        const inventory = await this.inventoryRepository.findOne({
          where: { productId: item.productId },
        });

        if (inventory) {
          const qty = item.quantity || 0;
          inventory.availableQuantity -= qty;
          inventory.reservedQuantity += qty;
          await this.inventoryRepository.save(inventory);
        }
      } catch (e) {
        // Inventory might not exist, continue
        this.logger.warn(`Inventory not found for product: ${item.productId}`);
      }
    }

    // Create initial status history
    const statusHistory = manager.create(OrderStatusHistory, {
      orderId: savedOrder.id,
      fromStatus: null as any,
      toStatus: OrderStatus.PENDING,
      comment: 'Order placed',
      updatedBy: buyerId,
    });
    await manager.save(statusHistory);

    // Remove cart items
    if (!queryRunner) {
      const cartItemIds = cartItems.map((item) => item.id);
      await manager.delete(CartItem, { id: In(cartItemIds) });
    }

    this.logger.log(`Order created: ${savedOrder.orderNumber}`);

    return savedOrder;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'items',
        'items.product',
        'buyer',
        'seller',
        'statusHistory',
        'tracking',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
      relations: [
        'items',
        'items.product',
        'buyer',
        'seller',
        'statusHistory',
        'tracking',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get buyer's orders
   */
  async getBuyerOrders(
    buyerId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedOrdersDto> {
    const [data, total] = await this.orderRepository.findAndCount({
      where: { buyerId },
      relations: ['items', 'items.product', 'seller', 'tracking'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get seller's orders
   */
  async getSellerOrders(
    sellerId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedOrdersDto> {
    const [data, total] = await this.orderRepository.findAndCount({
      where: { sellerId },
      relations: ['items', 'items.product', 'buyer', 'tracking'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update order status (seller only)
   */
  async updateOrderStatus(
    orderId: string,
    sellerId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);

    // Verify seller owns this order
    if (order.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own orders');
    }

    const oldStatus = order.status;

    // Validate status transition
    this.validateStatusTransition(oldStatus, updateStatusDto.status);

    // Update order status
    order.status = updateStatusDto.status;
    const savedOrder = await this.orderRepository.save(order);

    // Create status history
    const statusHistory = this.statusHistoryRepository.create({
      orderId: order.id,
      fromStatus: oldStatus,
      toStatus: updateStatusDto.status,
      comment: updateStatusDto.comment,
      updatedBy: sellerId,
    });
    await this.statusHistoryRepository.save(statusHistory);

    // Handle inventory based on new status
    if (updateStatusDto.status === OrderStatus.CANCELLED) {
      // Release reserved inventory
      for (const item of order.items) {
        try {
          const inventory = await this.inventoryRepository.findOne({
            where: { productId: item.productId },
          });

          if (inventory) {
            inventory.availableQuantity += item.quantity;
            inventory.reservedQuantity -= item.quantity;
            await this.inventoryRepository.save(inventory);
          }
        } catch (e) {
          this.logger.warn(`Failed to release inventory for product: ${item.productId}`);
        }
      }
    } else if (updateStatusDto.status === OrderStatus.CONFIRMED ||
               updateStatusDto.status === OrderStatus.PROCESSING) {
      // Fulfill reserved inventory
      for (const item of order.items) {
        try {
          const inventory = await this.inventoryRepository.findOne({
            where: { productId: item.productId },
          });

          if (inventory) {
            inventory.reservedQuantity -= item.quantity;
            inventory.quantity -= item.quantity;
            await this.inventoryRepository.save(inventory);
          }
        } catch (e) {
          this.logger.warn(`Failed to fulfill inventory for product: ${item.productId}`);
        }
      }
    }

    this.logger.log(`Order ${order.orderNumber} status changed: ${oldStatus} -> ${updateStatusDto.status}`);

    return this.getOrderById(orderId);
  }

  /**
   * Cancel order (buyer only)
   */
  async cancelOrder(
    orderId: string,
    buyerId: string,
    cancelDto: CancelOrderDto,
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);

    // Verify buyer owns this order
    if (order.buyerId !== buyerId) {
      throw new BadRequestException('You can only cancel your own orders');
    }

    // Can only cancel pending orders
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending orders');
    }

    const oldStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    const savedOrder = await this.orderRepository.save(order);

    // Create status history
    const statusHistory = this.statusHistoryRepository.create({
      orderId: order.id,
      fromStatus: oldStatus,
      toStatus: OrderStatus.CANCELLED,
      comment: cancelDto.reason || 'Order cancelled by buyer',
      updatedBy: buyerId,
    });
    await this.statusHistoryRepository.save(statusHistory);

    // Release reserved inventory
    for (const item of order.items) {
      try {
        const inventory = await this.inventoryRepository.findOne({
          where: { productId: item.productId },
        });

        if (inventory) {
          inventory.availableQuantity += item.quantity;
          inventory.reservedQuantity -= item.quantity;
          await this.inventoryRepository.save(inventory);
        }
      } catch (e) {
        this.logger.warn(`Failed to release inventory for product: ${item.productId}`);
      }
    }

    this.logger.log(`Order ${order.orderNumber} cancelled by buyer`);

    return this.getOrderById(orderId);
  }

  /**
   * Add tracking information
   */
  async addTracking(
    orderId: string,
    sellerId: string,
    updateTrackingDto: UpdateTrackingDto,
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);

    // Verify seller owns this order
    if (order.sellerId !== sellerId) {
      throw new BadRequestException('You can only add tracking to your own orders');
    }

    // Check if tracking already exists
    if (order.tracking) {
      // Update existing tracking
      order.tracking.carrier = updateTrackingDto.carrier;
      order.tracking.trackingNumber = updateTrackingDto.trackingNumber;
      await this.trackingRepository.save(order.tracking);
    } else {
      // Create new tracking
      const tracking = this.trackingRepository.create({
        orderId: order.id,
        carrier: updateTrackingDto.carrier,
        trackingNumber: updateTrackingDto.trackingNumber,
      });
      await this.trackingRepository.save(tracking);
      order.tracking = tracking;
    }

    // Update order status to SHIPPED if not already
    if (order.status !== OrderStatus.SHIPPED) {
      const oldStatus = order.status;
      order.status = OrderStatus.SHIPPED;
      await this.orderRepository.save(order);

      // Create status history
      const statusHistory = this.statusHistoryRepository.create({
        orderId: order.id,
        fromStatus: oldStatus,
        toStatus: OrderStatus.SHIPPED,
        comment: `Tracking: ${updateTrackingDto.carrier} - ${updateTrackingDto.trackingNumber}`,
        updatedBy: sellerId,
      });
      await this.statusHistoryRepository.save(statusHistory);
    }

    this.logger.log(`Tracking added to order ${order.orderNumber}`);

    return this.getOrderById(orderId);
  }

  /**
   * Get order tracking
   */
  async getOrderTracking(orderId: string): Promise<OrderTracking> {
    const order = await this.getOrderById(orderId);

    if (!order.tracking) {
      throw new NotFoundException('No tracking information available');
    }

    return order.tracking;
  }

  /**
   * Get order status history
   */
  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    return this.statusHistoryRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(fromStatus: OrderStatus, toStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    const allowed = validTransitions[fromStatus];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${fromStatus} to ${toStatus}`,
      );
    }
  }
}
