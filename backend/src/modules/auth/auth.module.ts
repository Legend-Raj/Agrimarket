import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Passport module
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT module
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret') || 'your-super-secret-jwt-key-change-in-production',
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn') || '7d',
        },
      }),
    }),

    // TypeORM entities
    TypeOrmModule.forFeature([User, Session]),

    // Users module
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
