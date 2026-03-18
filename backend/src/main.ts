import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Import all DTOs to register them in Swagger schema
// These imports ensure that Swagger picks up all the DTOs
import './modules/auth/dto/auth.dto';
import './modules/users/dto/user.dto';
import './modules/products/dto/product.dto';
import './modules/cart/dto/cart.dto';
import './modules/orders/dto/order.dto';
import './modules/addresses/dto/address.dto';
import './modules/promotions/dto/promotion.dto';
import './modules/inventory/dto/inventory.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Latitude', 'X-Client-Longitude'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('AgriMarket API')
    .setDescription('Agricultural E-commerce Platform API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('products', 'Product catalog')
    .addTag('cart', 'Shopping cart')
    .addTag('orders', 'Order management')
    .addTag('addresses', 'Address management')
    .addTag('promotions', 'Promotions & bundles')
    .addTag('dashboard', 'Dashboard analytics')
    .addTag('ai', 'AI Assistant')
    .addTag('notifications', 'Notifications')
    .addTag('inventory', 'Inventory management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`=================================================`);
  console.log(`  AgriMarket Backend Server`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  API URL: http://localhost:${port}/api`);
  console.log(`  Swagger Docs: http://localhost:${port}/api/docs`);
  console.log(`=================================================`);
}
bootstrap();
