import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  AdjustInventoryDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Create inventory for a product
   */
  @Post()
  @ApiOperation({ summary: 'Create inventory for a product' })
  @ApiBody({ type: CreateInventoryDto })
  @ApiResponse({ status: 201, description: 'Inventory created successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Inventory already exists' })
  async createInventory(
    @CurrentUser() user: User,
    @Body() createInventoryDto: CreateInventoryDto,
  ) {
    return this.inventoryService.createInventory(user.id, createInventoryDto);
  }

  /**
   * Get inventory by product ID
   */
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get inventory by product ID' })
  @ApiResponse({ status: 200, description: 'Inventory found' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  async getInventoryByProductId(
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.inventoryService.getInventoryByProductId(productId);
  }

  /**
   * Get all inventory for current seller
   */
  @Get('seller/me')
  @ApiOperation({ summary: "Get current seller's all inventory" })
  @ApiResponse({ status: 200, description: 'Inventory list retrieved' })
  async getMyInventory(@CurrentUser() user: User) {
    return this.inventoryService.getInventoryBySeller(user.id);
  }

  /**
   * Get low stock alerts
   */
  @Get('alerts/low-stock')
  @ApiOperation({ summary: 'Get low stock alerts' })
  @ApiResponse({ status: 200, description: 'Low stock products retrieved' })
  async getLowStockAlerts(@CurrentUser() user: User) {
    return this.inventoryService.getLowStockProducts(user.id);
  }

  /**
   * Update inventory
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update inventory' })
  @ApiBody({ type: UpdateInventoryDto })
  @ApiResponse({ status: 200, description: 'Inventory updated successfully' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiResponse({ status: 400, description: 'Invalid update' })
  async updateInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateInventory(id, user.id, updateInventoryDto);
  }

  /**
   * Adjust inventory (add/remove stock)
   */
  @Post(':id/adjust')
  @ApiOperation({ summary: 'Adjust inventory stock' })
  @ApiBody({ type: AdjustInventoryDto })
  @ApiResponse({ status: 200, description: 'Inventory adjusted successfully' })
  @ApiResponse({ status: 404, description: 'Inventory not found' })
  @ApiResponse({ status: 400, description: 'Invalid adjustment' })
  async adjustInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() adjustInventoryDto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjustInventory(id, user.id, adjustInventoryDto);
  }

  /**
   * Check product availability
   */
  @Get('check/:productId/:quantity')
  @ApiOperation({ summary: 'Check if product has sufficient inventory' })
  @ApiResponse({ status: 200, description: 'Availability check result' })
  async checkAvailability(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('quantity') quantity: string,
  ) {
    const isAvailable = await this.inventoryService.checkAvailability(
      productId,
      parseInt(quantity, 10),
    );
    return { productId, quantity: parseInt(quantity, 10), isAvailable };
  }
}
