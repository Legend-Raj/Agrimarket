import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  FilterProductsDto,
  ProductResponseDto,
  FilterOptionsDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards';
import { RolesGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { Public } from '../../common/decorators';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  // ==================== Filter Options (MUST come before generic @Get) ====================

  /**
   * Get dynamic filter options (for filter sidebar)
   * IMPORTANT: This route MUST be defined before @Get() to avoid route conflict
   */
  @Get('filters')
  @Public()
  @ApiOperation({ summary: 'Get dynamic filter options for product listing' })
  @ApiResponse({ status: 200, description: 'Filter options retrieved successfully' })
  async getFilterOptions() {
    return this.productsService.getFilterOptions();
  }

  // ==================== Categories ====================

  /**
   * Create a new category
   */
  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 409, description: 'Category already exists' })
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.productsService.createCategory(createCategoryDto);
  }

  /**
   * Get all categories
   */
  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get all product categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.productsService.getCategories();
  }

  /**
   * Get category by ID
   */
  @Get('categories/:id')
  @Public()
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getCategoryById(id);
  }

  /**
   * Update category
   */
  @Put('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(id, updateCategoryDto);
  }

  /**
   * Delete category
   */
  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.productsService.deleteCategory(id);
    return { message: 'Category deleted successfully' };
  }

  // ==================== Products ====================

  /**
   * Create a new product
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (Seller/Manufacturer only)' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 409, description: 'Product with SKU already exists' })
  async createProduct(
    @CurrentUser() user: User,
    @Body() createProductDto: CreateProductDto,
  ) {
    // Only retailers and manufacturers can create products
    if (user.role !== UserRole.RETAILER && user.role !== UserRole.MANUFACTURER) {
      throw new Error('Only retailers and manufacturers can create products');
    }
    return this.productsService.createProduct(user.id, createProductDto);
  }

  /**
   * Get products by category
   */
  @Get('category/:categoryId')
  @Public()
  @ApiOperation({ summary: 'Get products by category' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async getProductsByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() filters: FilterProductsDto,
  ) {
    return this.productsService.getProductsByCategory(categoryId, filters);
  }

  /**
   * Get nearby products
   */
  @Get('nearby')
  @Public()
  @ApiOperation({ summary: 'Get products within delivery radius' })
  @ApiResponse({ status: 200, description: 'Nearby products retrieved successfully' })
  @ApiQuery({ name: 'latitude', required: true })
  @ApiQuery({ name: 'longitude', required: true })
  async getNearbyProducts(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query() filters: FilterProductsDto,
  ) {
    return this.productsService.getNearbyProducts(
      parseFloat(latitude),
      parseFloat(longitude),
      filters,
    );
  }

  /**
   * Get product by SKU
   */
  @Get('sku/:sku')
  @Public()
  @ApiOperation({ summary: 'Get product by SKU' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductBySku(@Param('sku') sku: string) {
    return this.productsService.getProductBySku(sku);
  }

  /**
   * Get seller's products
   */
  @Get('seller/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current seller's products" })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async getMyProducts(
    @CurrentUser() user: User,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.productsService.getProductsBySeller(
      user.id,
      includeInactive === 'true',
    );
  }

  /**
   * Get all products with filters (generic route - MUST come last)
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all products with filters' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiQuery({ name: 'sellerId', required: false })
  @ApiQuery({ name: 'manufacturer', required: false })
  async getProducts(
    @Query() filters: FilterProductsDto,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    const lat = latitude ? parseFloat(latitude) : undefined;
    const lon = longitude ? parseFloat(longitude) : undefined;
    return this.productsService.getProducts(filters, lat, lon);
  }

  /**
   * Get product by ID (MUST come after specific routes like /filters, /categories, etc.)
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getProductById(id);
  }

  /**
   * Update product
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, user.id, updateProductDto);
  }

  /**
   * Delete (soft delete) product
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.productsService.deleteProduct(id, user.id);
  }
}
