import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Product } from '../products/entities/product.entity';
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  AdjustInventoryDto,
  InventoryResponseDto,
  LowStockAlertDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Create inventory record for a product
   */
  async createInventory(
    sellerId: string,
    createInventoryDto: CreateInventoryDto,
  ): Promise<Inventory> {
    // Verify product exists and belongs to seller
    const product = await this.productRepository.findOne({
      where: { id: createInventoryDto.productId, sellerId },
    });

    if (!product) {
      throw new NotFoundException('Product not found or does not belong to you');
    }

    // Check if inventory already exists
    const existingInventory = await this.inventoryRepository.findOne({
      where: { productId: createInventoryDto.productId },
    });

    if (existingInventory) {
      throw new BadRequestException('Inventory already exists for this product');
    }

    const quantity = createInventoryDto.quantity || 0;
    const availableQuantity = quantity; // Initially all is available

    const inventory = this.inventoryRepository.create({
      ...createInventoryDto,
      quantity,
      availableQuantity,
      reservedQuantity: 0,
    });

    const savedInventory = await this.inventoryRepository.save(inventory);
    this.logger.log(`Inventory created for product: ${product.id}`);

    return savedInventory;
  }

  /**
   * Get inventory by product ID
   */
  async getInventoryByProductId(productId: string): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { productId },
      relations: ['product'],
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found for this product');
    }

    return inventory;
  }

  /**
   * Get inventory by ID
   */
  async getInventoryById(id: string): Promise<Inventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { id },
      relations: ['product'],
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return inventory;
  }

  /**
   * Get all inventory for a seller
   */
  async getInventoryBySeller(sellerId: string): Promise<Inventory[]> {
    return this.inventoryRepository
      .createQueryBuilder('inventory')
      .innerJoin('inventory.product', 'product')
      .where('product.sellerId = :sellerId', { sellerId })
      .leftJoinAndSelect('inventory.product', 'invProduct')
      .getMany();
  }

  /**
   * Update inventory
   */
  async updateInventory(
    id: string,
    sellerId: string,
    updateInventoryDto: UpdateInventoryDto,
  ): Promise<Inventory> {
    const inventory = await this.getInventoryById(id);

    // Verify ownership
    if (inventory.product.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own inventory');
    }

    // If quantity is being updated, recalculate available
    if (updateInventoryDto.quantity !== undefined) {
      const newAvailable =
        updateInventoryDto.quantity - inventory.reservedQuantity;

      if (newAvailable < 0) {
        throw new BadRequestException(
          'Quantity cannot be less than reserved quantity',
        );
      }

      updateInventoryDto['availableQuantity'] = newAvailable;
    }

    Object.assign(inventory, updateInventoryDto);
    return this.inventoryRepository.save(inventory);
  }

  /**
   * Adjust inventory (add or remove stock)
   */
  async adjustInventory(
    id: string,
    sellerId: string,
    adjustInventoryDto: AdjustInventoryDto,
  ): Promise<Inventory> {
    const inventory = await this.getInventoryById(id);

    // Verify ownership
    if (inventory.product.sellerId !== sellerId) {
      throw new BadRequestException('You can only adjust your own inventory');
    }

    const { adjustment } = adjustInventoryDto;

    // Calculate new quantities
    const newQuantity = inventory.quantity + adjustment;

    if (newQuantity < 0) {
      throw new BadRequestException(
        'Adjustment would result in negative inventory',
      );
    }

    const newAvailable = inventory.availableQuantity + adjustment;

    if (newAvailable < 0) {
      throw new BadRequestException(
        'Adjustment would result in negative available quantity',
      );
    }

    inventory.quantity = newQuantity;
    inventory.availableQuantity = newAvailable;

    const savedInventory = await this.inventoryRepository.save(inventory);
    const action = adjustInventoryDto.adjustment >= 0 ? 'added' : 'removed';
    this.logger.log(
      `Inventory adjusted for product ${inventory.productId}: ${action} ${Math.abs(adjustInventoryDto.adjustment)} units`,
    );

    return savedInventory;
  }

  /**
   * Reserve inventory (for orders)
   */
  async reserveInventory(
    productId: string,
    quantity: number,
  ): Promise<Inventory> {
    const inventory = await this.getInventoryByProductId(productId);

    if (inventory.availableQuantity < quantity) {
      throw new BadRequestException('Insufficient inventory available');
    }

    inventory.availableQuantity -= quantity;
    inventory.reservedQuantity += quantity;

    return this.inventoryRepository.save(inventory);
  }

  /**
   * Release reserved inventory (if order cancelled)
   */
  async releaseReservedInventory(
    productId: string,
    quantity: number,
  ): Promise<Inventory> {
    const inventory = await this.getInventoryByProductId(productId);

    const releaseQuantity = Math.min(quantity, inventory.reservedQuantity);

    inventory.availableQuantity += releaseQuantity;
    inventory.reservedQuantity -= releaseQuantity;

    return this.inventoryRepository.save(inventory);
  }

  /**
   * Fulfill inventory (convert reserved to sold)
   */
  async fulfillInventory(
    productId: string,
    quantity: number,
  ): Promise<Inventory> {
    const inventory = await this.getInventoryByProductId(productId);

    if (inventory.reservedQuantity < quantity) {
      throw new BadRequestException('Insufficient reserved inventory');
    }

    inventory.reservedQuantity -= quantity;
    inventory.quantity -= quantity; // Reduce total quantity by sold amount

    return this.inventoryRepository.save(inventory);
  }

  /**
   * Get low stock products for a seller
   */
  async getLowStockProducts(sellerId: string): Promise<LowStockAlertDto[]> {
    const inventories = await this.inventoryRepository
      .createQueryBuilder('inventory')
      .innerJoin('inventory.product', 'product')
      .where('product.sellerId = :sellerId', { sellerId })
      .andWhere('inventory.trackQuantity = :trackQuantity', { trackQuantity: true })
      .andWhere('inventory.lowStockThreshold IS NOT NULL')
      .andWhere('inventory.quantity <= inventory.lowStockThreshold')
      .getMany();

    return inventories.map((inv) => ({
      productId: inv.productId,
      productName: inv.product?.name || '',
      currentQuantity: inv.quantity,
      lowStockThreshold: inv.lowStockThreshold || 0,
      availableQuantity: inv.availableQuantity,
    }));
  }

  /**
   * Check if product has sufficient inventory
   */
  async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    try {
      const inventory = await this.getInventoryByProductId(productId);
      return inventory.availableQuantity >= quantity;
    } catch {
      return false;
    }
  }

  /**
   * Get or create inventory for a product
   */
  async getOrCreateInventory(productId: string): Promise<Inventory> {
    try {
      return await this.getInventoryByProductId(productId);
    } catch {
      // Create default inventory if it doesn't exist
      const inventory = this.inventoryRepository.create({
        productId,
        quantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
        trackQuantity: true,
      });
      return this.inventoryRepository.save(inventory);
    }
  }
}
