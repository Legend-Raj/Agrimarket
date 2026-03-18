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
  ApiBody,
} from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ValidatePromotionDto,
  CreateBundleDto,
  UpdateBundleDto,
} from './dto/promotion.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { Public } from '../../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  private readonly logger = new Logger(PromotionsController.name);

  constructor(private readonly promotionsService: PromotionsService) {}

  // ==================== Promotions ====================

  /**
   * Create a new promotion (seller only)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promotion' })
  @ApiBody({ type: CreatePromotionDto })
  @ApiResponse({ status: 201, description: 'Promotion created' })
  @ApiResponse({ status: 409, description: 'Code already exists' })
  async createPromotion(
    @CurrentUser() user: User,
    @Body() createPromotionDto: CreatePromotionDto,
  ) {
    return this.promotionsService.createPromotion(user.id, createPromotionDto);
  }

  /**
   * Get all active promotions (public)
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all active promotions' })
  @ApiResponse({ status: 200, description: 'Promotions retrieved' })
  async getActivePromotions() {
    return this.promotionsService.getActivePromotions();
  }

  /**
   * Get seller's promotions
   */
  @Get('seller/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get seller's promotions" })
  @ApiResponse({ status: 200, description: 'Promotions retrieved' })
  async getMyPromotions(@CurrentUser() user: User) {
    return this.promotionsService.getPromotionsBySeller(user.id);
  }

  /**
   * Validate promotion code
   */
  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a promotion code' })
  @ApiBody({ type: ValidatePromotionDto })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validatePromotion(@Body() validateDto: ValidatePromotionDto) {
    return this.promotionsService.validatePromotion(
      validateDto.code,
      validateDto.orderAmount,
    );
  }

  /**
   * Get promotion by ID
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get promotion by ID' })
  @ApiResponse({ status: 200, description: 'Promotion found' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async getPromotionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.getPromotionById(id);
  }

  /**
   * Update promotion
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion' })
  @ApiBody({ type: UpdatePromotionDto })
  @ApiResponse({ status: 200, description: 'Promotion updated' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async updatePromotion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(id, user.id, updatePromotionDto);
  }

  /**
   * Delete promotion
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a promotion' })
  @ApiResponse({ status: 204, description: 'Promotion deleted' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async deletePromotion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.promotionsService.deletePromotion(id, user.id);
  }

  // ==================== Bundles ====================

  /**
   * Create a new bundle (seller only)
   */
  @Post('bundles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new bundle' })
  @ApiBody({ type: CreateBundleDto })
  @ApiResponse({ status: 201, description: 'Bundle created' })
  async createBundle(
    @CurrentUser() user: User,
    @Body() createBundleDto: CreateBundleDto,
  ) {
    return this.promotionsService.createBundle(user.id, createBundleDto);
  }

  /**
   * Get all active bundles (public)
   */
  @Get('bundles')
  @Public()
  @ApiOperation({ summary: 'Get all active bundles' })
  @ApiResponse({ status: 200, description: 'Bundles retrieved' })
  async getActiveBundles() {
    return this.promotionsService.getActiveBundles();
  }

  /**
   * Get seller's bundles
   */
  @Get('bundles/seller/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get seller's bundles" })
  @ApiResponse({ status: 200, description: 'Bundles retrieved' })
  async getMyBundles(@CurrentUser() user: User) {
    return this.promotionsService.getBundlesBySeller(user.id);
  }

  /**
   * Get bundle by ID
   */
  @Get('bundles/:id')
  @Public()
  @ApiOperation({ summary: 'Get bundle by ID' })
  @ApiResponse({ status: 200, description: 'Bundle found' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async getBundleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.getBundleById(id);
  }

  /**
   * Update bundle
   */
  @Put('bundles/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a bundle' })
  @ApiBody({ type: UpdateBundleDto })
  @ApiResponse({ status: 200, description: 'Bundle updated' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async updateBundle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateBundleDto: UpdateBundleDto,
  ) {
    return this.promotionsService.updateBundle(id, user.id, updateBundleDto);
  }

  /**
   * Delete bundle
   */
  @Delete('bundles/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a bundle' })
  @ApiResponse({ status: 204, description: 'Bundle deleted' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async deleteBundle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.promotionsService.deleteBundle(id, user.id);
  }
}
