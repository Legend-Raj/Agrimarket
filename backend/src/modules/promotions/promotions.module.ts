import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { Promotion } from './entities/promotion.entity';
import { Bundle } from './entities/bundle.entity';
import { ProductReview } from './entities/product-review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, Bundle, ProductReview])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
