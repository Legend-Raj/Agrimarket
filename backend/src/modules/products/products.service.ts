import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, SelectQueryBuilder } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  FilterProductsDto,
  PaginatedProductsDto,
  ProductResponseDto,
  FilterOptionsDto,
} from './dto/product.dto';
import { ProductStatus } from '../../common/enums';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private categoryRepository: Repository<ProductCategory>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
  ) {}

  /**
   * Map Product entity to ProductResponseDto with inventory stock.
   * Includes null-safety for all optional relations.
   */
  private mapProductToResponse(product: Product, inventory?: Inventory | null): ProductResponseDto {
    return {
      id: product.id,
      name: product.name ?? '',
      description: product.description ?? null,
      price: Number(product.price) || 0,
      pointsCost: Number(product.price) || 0,  // Alias for backward compat
      currency: product.currency || 'USD',
      minimumQuantity: product.minimumQuantity ?? 1,
      deliveryRadius: product.deliveryRadius ?? 0,
      status: product.status || ProductStatus.ACTIVE,
      sku: product.sku ?? null,
      categoryId: product.categoryId ?? null,
      category: product.category ?? null,
      sellerId: product.sellerId,
      seller: product.seller ? {
        id: product.seller.id,
        firstName: product.seller.firstName ?? '',
        lastName: product.seller.lastName ?? '',
        email: product.seller.email ?? '',
        companyName: product.seller.companyName ?? null,
      } : null,
      unit: product.unit ?? null,
      isActive: product.isActive ?? true,
      imageUrl: product.primaryImageUrl ?? null,
      stock: inventory?.availableQuantity ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // ==================== Categories ====================

  /**
   * Create a new product category
   */
  async createCategory(createCategoryDto: CreateCategoryDto): Promise<ProductCategory> {
    // Check if slug already exists
    const existingCategory = await this.categoryRepository.findOne({
      where: { slug: createCategoryDto.slug },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this slug already exists');
    }

    // Handle parent category
    if (createCategoryDto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Get all categories (tree structure)
   */
  async getCategories(): Promise<ProductCategory[]> {
    return this.categoryRepository.find({
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<ProductCategory> {
    const category = await this.getCategoryById(id);

    // Check for duplicate slug
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { slug: updateCategoryDto.slug },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    // Prevent circular parent reference
    if (updateCategoryDto.parentId === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);

    // Check if category has products
    const productCount = await this.productRepository.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with products. Move or delete products first.',
      );
    }

    // Check if category has children
    const childCount = await this.categoryRepository.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with subcategories. Delete subcategories first.',
      );
    }

    await this.categoryRepository.remove(category);
  }

  // ==================== Products ====================

  /**
   * Create a new product
   */
  async createProduct(
    sellerId: string,
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    // Check for duplicate SKU
    if (createProductDto.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: createProductDto.sku },
      });

      if (existingProduct) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Validate category if provided
    if (createProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: createProductDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const product = this.productRepository.create({
      ...createProductDto,
      sellerId,
      status: createProductDto.status || ProductStatus.ACTIVE,
      isActive: true,
    });

    const savedProduct = await this.productRepository.save(product);
    this.logger.log(`Product created: ${savedProduct.id} by seller: ${sellerId}`);

    // Auto-create inventory record for the product
    const inventory = this.inventoryRepository.create({
      productId: savedProduct.id,
      quantity: 0,
      availableQuantity: 0,
      reservedQuantity: 0,
      trackQuantity: true,
    });
    await this.inventoryRepository.save(inventory);
    this.logger.log(`Inventory auto-created for product: ${savedProduct.id}`);

    return savedProduct;
  }

  /**
   * Get products with filters
   *
   * Multi-select filtering logic:
   * - categoryIds: comma-separated IDs -> OR logic (product matches ANY category)
   * - sellerIds: comma-separated IDs -> OR logic (product matches ANY seller)
   * - Different filter types -> AND logic (all conditions must match)
   */
  async getProducts(
    filters: FilterProductsDto,
    userLat?: number,
    userLon?: number,
  ): Promise<PaginatedProductsDto> {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      categoryIds,
      status,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      sellerId,
      sellerIds,
      manufacturer,
    } = filters;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoinAndSelect('product.inventory', 'inventory');

    // Search filter
    if (search) {
      queryBuilder.andWhere(
        '(product.name LIKE :search OR product.description LIKE :search OR product.sku LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Category filter - support both single and multiple (OR logic)
    // Parse categoryIds from comma-separated string if provided
    const categoryIdList = categoryIds
      ? categoryIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : [];

    if (categoryIdList.length > 0) {
      // Multiple categories: OR logic - product matches ANY of the selected categories
      queryBuilder.andWhere(`product.categoryId IN (:...categoryIds)`, { categoryIds: categoryIdList });
    } else if (categoryId) {
      // Single category (backward compatibility)
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Status filter (default to ACTIVE for public listing)
    const statusFilter = status || ProductStatus.ACTIVE;
    queryBuilder.andWhere('product.status = :status', { status: statusFilter });

    // Active filter
    queryBuilder.andWhere('product.isActive = :isActive', { isActive: true });

    // Price range filters
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Seller filter - support both single and multiple (OR logic)
    // Parse sellerIds from comma-separated string if provided
    const sellerIdList = sellerIds
      ? sellerIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : [];

    if (sellerIdList.length > 0) {
      // Multiple sellers: OR logic - product matches ANY of the selected sellers
      queryBuilder.andWhere(`product.sellerId IN (:...sellerIds)`, { sellerIds: sellerIdList });
    } else if (sellerId) {
      // Single seller (backward compatibility)
      queryBuilder.andWhere('product.sellerId = :sellerId', { sellerId });
    }

    // Manufacturer/brand name filter (partial match on company name)
    if (manufacturer) {
      queryBuilder.andWhere('seller.companyName LIKE :manufacturer', { manufacturer: `%${manufacturer}%` });
    }

    // Location-based filtering (if user location provided AND seller has coordinates)
    if (userLat !== undefined && userLon !== undefined) {
      queryBuilder.andWhere(
        `(
          seller.latitude IS NOT NULL
          AND seller.longitude IS NOT NULL
          AND (6371 * acos(
            cos(radians(:lat)) * cos(radians(seller.latitude)) *
            cos(radians(seller.longitude) - radians(:lon)) +
            sin(radians(:lat)) * sin(radians(seller.latitude))
          )) <= product.deliveryRadius
        )`,
        { lat: userLat, lon: userLon },
      );
    }

    // Sorting
    const validSortFields = ['createdAt', 'price', 'name'];
    const sortField = validSortFields.includes(sortBy || '') ? sortBy : 'createdAt';
    queryBuilder.orderBy(`product.${sortField}`, sortOrder || 'DESC');

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [products, total] = await queryBuilder.getManyAndCount();

    // Map to DTOs with inventory stock
    const data = products.map(product => this.mapProductToResponse(product, product.inventory));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'seller', 'inventory'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToResponse(product, product.inventory);
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { sku },
      relations: ['category', 'seller', 'inventory'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToResponse(product, product.inventory);
  }

  /**
   * Get products by seller
   */
  async getProductsBySeller(sellerId: string, includeInactive = false): Promise<ProductResponseDto[]> {
    const where: any = { sellerId };

    if (!includeInactive) {
      where.isActive = true;
    }

    const products = await this.productRepository.find({
      where,
      relations: ['category', 'inventory'],
      order: { createdAt: 'DESC' },
    });

    return products.map(product => this.mapProductToResponse(product, product.inventory));
  }

  /**
   * Update product
   */
  async updateProduct(
    id: string,
    sellerId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    // Fetch the entity directly (not the DTO) so we can save it
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'seller', 'inventory'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify ownership (or admin)
    if (product.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own products');
    }

    // Check for duplicate SKU
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: updateProductDto.sku },
      });

      if (existingProduct) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    Object.assign(product, updateProductDto);
    const updatedProduct = await this.productRepository.save(product);
    this.logger.log(`Product updated: ${id}`);

    return updatedProduct;
  }

  /**
   * Delete (soft delete) product
   */
  async deleteProduct(id: string, sellerId: string): Promise<void> {
    // Fetch the entity directly so we can save changes
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify ownership
    if (product.sellerId !== sellerId) {
      throw new BadRequestException('You can only delete your own products');
    }

    // Soft delete - just mark as inactive
    product.isActive = false;
    product.status = ProductStatus.INACTIVE;
    await this.productRepository.save(product);

    this.logger.log(`Product deleted (soft): ${id}`);
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    categoryId: string,
    filters: FilterProductsDto,
  ): Promise<PaginatedProductsDto> {
    return this.getProducts({ ...filters, categoryId });
  }

  /**
   * Get nearby products (within delivery radius)
   */
  async getNearbyProducts(
    latitude: number,
    longitude: number,
    filters: FilterProductsDto,
  ): Promise<PaginatedProductsDto> {
    return this.getProducts(filters, latitude, longitude);
  }

  /**
   * Get dynamic filter options from the database.
   * Used by the frontend filter sidebar to populate options dynamically.
   */
  async getFilterOptions(): Promise<FilterOptionsDto> {
    // Get categories with product counts (join from Product -> Category)
    // so we only count active products belonging to each category
    const categories = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.category', 'cat')
      .select('cat.id', 'id')
      .addSelect('cat.name', 'name')
      .addSelect('cat.slug', 'slug')
      .addSelect('COUNT(product.id)', 'productCount')
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('cat.id IS NOT NULL')
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .addGroupBy('cat.slug')
      .orderBy('cat.name', 'ASC')
      .getRawMany();

    // Get price range from all active products
    const priceStats = await this.productRepository
      .createQueryBuilder('product')
      .select('MIN(product.price)', 'minPrice')
      .addSelect('MAX(product.price)', 'maxPrice')
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getRawOne();

    // Get sellers with product counts (only those with active products)
    const sellers = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.seller', 'seller')
      .select('seller.id', 'id')
      .addSelect('seller.companyName', 'companyName')
      .addSelect('COUNT(product.id)', 'productCount')
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .groupBy('seller.id')
      .addGroupBy('seller.companyName')
      .orderBy('productCount', 'DESC')
      .getRawMany();

    // Get total active product count
    const totalProducts = await this.productRepository.count({
      where: { isActive: true, status: ProductStatus.ACTIVE },
    });

    return {
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: parseInt(c.productCount, 10) || 0,
      })),
      priceRange: {
        min: parseFloat(priceStats?.minPrice) || 0,
        max: parseFloat(priceStats?.maxPrice) || 0,
      },
      sellers: sellers.map(s => ({
        id: s.id,
        companyName: s.companyName || null,
        productCount: parseInt(s.productCount, 10) || 0,
      })),
      totalProducts,
    };
  }
}
