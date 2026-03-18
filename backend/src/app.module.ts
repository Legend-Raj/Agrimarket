import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LocationsModule } from './modules/locations/locations.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration module (global)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): any => {
        const host = configService.get('database.host');
        const port = configService.get('database.port');
        const db = configService.get('database.name');
        const username = configService.get('database.username');
        const password = configService.get('database.password');

        return {
          type: 'mssql' as const,
          host,
          port,
          username,
          password,
          database: db,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('database.synchronize') ?? true,
          logging: configService.get('database.logging') ?? true,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
          },
        };
      },
    }),

    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 5,    // 5 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,  // 10 seconds
        limit: 50,   // 50 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,  // 1 minute
        limit: 200,  // 200 requests per minute
      },
    ]),

    // Application modules
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    PromotionsModule,
    InventoryModule,
    NotificationsModule,
    DashboardModule,
    LocationsModule,
  ],
  controllers: [],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
