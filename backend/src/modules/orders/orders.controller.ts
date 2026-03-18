import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
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
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  UpdateTrackingDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Get current user's orders (buyer)
   */
  @Get()
  @ApiOperation({ summary: 'Get current user orders (as buyer)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getMyOrders(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getBuyerOrders(
      user.id,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Get seller's orders
   */
  @Get('seller')
  @ApiOperation({ summary: "Get seller's orders" })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getSellerOrders(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getSellerOrders(
      user.id,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Get order by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.getOrderById(orderId);

    // Verify user has access (buyer or seller)
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      throw new Error('Access denied');
    }

    return order;
  }

  /**
   * Get order by order number
   */
  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Get order by order number' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.getOrderByNumber(orderNumber);

    // Verify user has access (buyer or seller)
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      throw new Error('Access denied');
    }

    return order;
  }

  /**
   * Get order tracking
   */
  @Get(':id/tracking')
  @ApiOperation({ summary: 'Get order tracking information' })
  @ApiResponse({ status: 200, description: 'Tracking info' })
  @ApiResponse({ status: 404, description: 'Tracking not found' })
  async getOrderTracking(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.getOrderById(orderId);

    // Verify user has access
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      throw new Error('Access denied');
    }

    return this.ordersService.getOrderTracking(orderId);
  }

  /**
   * Get order status history
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get order status history' })
  @ApiResponse({ status: 200, description: 'Status history' })
  async getOrderStatusHistory(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.getOrderById(orderId);

    // Verify user has access
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      throw new Error('Access denied');
    }

    return this.ordersService.getOrderStatusHistory(orderId);
  }

  /**
   * Update order status (seller only)
   */
  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status (seller only)' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(orderId, user.id, updateStatusDto);
  }

  /**
   * Cancel order (buyer only)
   */
  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel order (buyer only)' })
  @ApiBody({ type: CancelOrderDto })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  async cancelOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() cancelDto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(orderId, user.id, cancelDto);
  }

  /**
   * Add tracking information (seller only)
   */
  @Post(':id/tracking')
  @ApiOperation({ summary: 'Add tracking information' })
  @ApiBody({ type: UpdateTrackingDto })
  @ApiResponse({ status: 201, description: 'Tracking added' })
  async addTracking(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() updateTrackingDto: UpdateTrackingDto,
  ) {
    return this.ordersService.addTracking(orderId, user.id, updateTrackingDto);
  }
}
