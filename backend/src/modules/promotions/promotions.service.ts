import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, DiscountType } from './entities/promotion.entity';
import { Bundle } from './entities/bundle.entity';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ApplyPromotionDto,
  CreateBundleDto,
  UpdateBundleDto,
  PromotionResponseDto,
  BundleResponseDto,
  ValidationResultDto,
} from './dto/promotion.dto';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectRepository(Promotion)
    private promotionRepository: Repository<Promotion>,
    @InjectRepository(Bundle)
    private bundleRepository: Repository<Bundle>,
  ) {}

  // ==================== Promotions ====================

  /**
   * Create a new promotion
   */
  async createPromotion(
    sellerId: string,
    createPromotionDto: CreatePromotionDto,
  ): Promise<Promotion> {
    // Check for duplicate code
    const existing = await this.promotionRepository.findOne({
      where: { code: createPromotionDto.code },
    });

    if (existing) {
      throw new ConflictException('Promotion code already exists');
    }

    // Validate dates
    const startDate = new Date(createPromotionDto.startDate);
    const endDate = new Date(createPromotionDto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate discount value based on type
    if (
      createPromotionDto.discountType === DiscountType.PERCENTAGE &&
      createPromotionDto.discountValue > 100
    ) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const promotion = this.promotionRepository.create({
      ...createPromotionDto,
      sellerId,
      usageCount: 0,
      isActive: true,
    });

    const savedPromotion = await this.promotionRepository.save(promotion);
    this.logger.log(`Promotion created: ${savedPromotion.code}`);

    return savedPromotion;
  }

  /**
   * Get all active promotions
   */
  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();

    return this.promotionRepository
      .createQueryBuilder('promotion')
      .where('promotion.isActive = :isActive', { isActive: true })
      .andWhere('promotion.startDate <= :now', { now })
      .andWhere('promotion.endDate >= :now', { now })
      .andWhere('promotion.usageCount < promotion.usageLimit')
      .orderBy('promotion.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Get promotions by seller
   */
  async getPromotionsBySeller(sellerId: string): Promise<Promotion[]> {
    return this.promotionRepository.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({
      where: { id },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  /**
   * Validate promotion code
   */
  async validatePromotion(
    code: string,
    orderAmount?: number,
  ): Promise<ValidationResultDto> {
    const promotion = await this.promotionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      return {
        valid: false,
        message: 'Invalid promotion code',
      };
    }

    // Check if active
    if (!promotion.isActive) {
      return {
        valid: false,
        message: 'This promotion is no longer active',
        promotion,
      };
    }

    // Check date range
    const now = new Date();
    if (now < promotion.startDate) {
      return {
        valid: false,
        message: 'This promotion is not yet active',
        promotion,
      };
    }

    if (now > promotion.endDate) {
      return {
        valid: false,
        message: 'This promotion has expired',
        promotion,
      };
    }

    // Check usage limit
    if (promotion.usageCount >= promotion.usageLimit) {
      return {
        valid: false,
        message: 'This promotion has reached its usage limit',
        promotion,
      };
    }

    // Check minimum order amount
    if (orderAmount !== undefined && promotion.minimumOrderAmount) {
      if (orderAmount < promotion.minimumOrderAmount) {
        return {
          valid: false,
          message: `Minimum order amount is ${promotion.minimumOrderAmount}`,
          promotion,
        };
      }
    }

    // Calculate discount
    let discount = 0;
    if (promotion.discountType === DiscountType.PERCENTAGE) {
      discount = (orderAmount || 0) * (promotion.discountValue / 100);
    } else {
      discount = promotion.discountValue;
    }

    // Apply maximum discount cap
    if (promotion.maximumDiscount && discount > promotion.maximumDiscount) {
      discount = promotion.maximumDiscount;
    }

    return {
      valid: true,
      discount,
      message: `Discount applied: ${discount.toFixed(2)}`,
      promotion,
    };
  }

  /**
   * Apply promotion (increment usage count)
   */
  async applyPromotion(
    code: string,
    orderAmount: number,
  ): Promise<ValidationResultDto> {
    const validation = await this.validatePromotion(code, orderAmount);

    if (!validation.valid) {
      return validation;
    }

    // Increment usage count
    await this.promotionRepository.increment(
      { code: code.toUpperCase() },
      'usageCount',
      1,
    );

    this.logger.log(`Promotion applied: ${code}`);

    return validation;
  }

  /**
   * Update promotion
   */
  async updatePromotion(
    id: string,
    sellerId: string,
    updatePromotionDto: UpdatePromotionDto,
  ): Promise<Promotion> {
    const promotion = await this.getPromotionById(id);

    // Verify ownership
    if (promotion.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own promotions');
    }

    // If updating code, check for duplicates
    if (updatePromotionDto.code && updatePromotionDto.code !== promotion.code) {
      const existing = await this.promotionRepository.findOne({
        where: { code: updatePromotionDto.code },
      });

      if (existing) {
        throw new ConflictException('Promotion code already exists');
      }
    }

    Object.assign(promotion, updatePromotionDto);
    return this.promotionRepository.save(promotion);
  }

  /**
   * Delete promotion
   */
  async deletePromotion(id: string, sellerId: string): Promise<void> {
    const promotion = await this.getPromotionById(id);

    // Verify ownership
    if (promotion.sellerId !== sellerId) {
      throw new BadRequestException('You can only delete your own promotions');
    }

    await this.promotionRepository.remove(promotion);
    this.logger.log(`Promotion deleted: ${promotion.code}`);
  }

  // ==================== Bundles ====================

  /**
   * Create a new bundle
   */
  async createBundle(
    sellerId: string,
    createBundleDto: CreateBundleDto,
  ): Promise<Bundle> {
    const bundle = new Bundle();
    bundle.name = createBundleDto.name;
    bundle.description = createBundleDto.description;
    bundle.bundlePrice = createBundleDto.bundlePrice;
    bundle.productIds = JSON.stringify(createBundleDto.productIds); // Convert array to JSON string
    bundle.sellerId = sellerId;
    bundle.isActive = createBundleDto.isActive ?? true;

    const savedBundle = await this.bundleRepository.save(bundle);
    this.logger.log(`Bundle created: ${savedBundle.name}`);

    return savedBundle;
  }

  /**
   * Get all active bundles
   */
  async getActiveBundles(): Promise<Bundle[]> {
    return this.bundleRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get bundles by seller
   */
  async getBundlesBySeller(sellerId: string): Promise<Bundle[]> {
    return this.bundleRepository.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get bundle by ID
   */
  async getBundleById(id: string): Promise<Bundle> {
    const bundle = await this.bundleRepository.findOne({
      where: { id },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    return bundle;
  }

  /**
   * Update bundle
   */
  async updateBundle(
    id: string,
    sellerId: string,
    updateBundleDto: UpdateBundleDto,
  ): Promise<Bundle> {
    const bundle = await this.getBundleById(id);

    // Verify ownership
    if (bundle.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own bundles');
    }

    Object.assign(bundle, updateBundleDto);
    return this.bundleRepository.save(bundle);
  }

  /**
   * Delete bundle
   */
  async deleteBundle(id: string, sellerId: string): Promise<void> {
    const bundle = await this.getBundleById(id);

    // Verify ownership
    if (bundle.sellerId !== sellerId) {
      throw new BadRequestException('You can only delete your own bundles');
    }

    await this.bundleRepository.remove(bundle);
    this.logger.log(`Bundle deleted: ${bundle.name}`);
  }
}
