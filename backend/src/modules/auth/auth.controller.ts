import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto, RefreshTokenDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Register a new user
   */
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    this.logger.log(`Register attempt for email: ${registerDto.email}`);
    const result = await this.authService.register(registerDto);
    this.logger.log(`User registered successfully: ${registerDto.email}`);
    return result;
  }

  /**
   * Login user - Rate limited to prevent brute force attacks
   * Max 5 attempts per second, 20 attempts per minute
   */
  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { ttl: 1000, limit: 5 }, long: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests - rate limit exceeded' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);
    const result = await this.authService.login(
      loginDto,
      '127.0.0.1',
      'Swagger UI',
    );
    this.logger.log(`User logged in successfully: ${loginDto.email}`);
    return result;
  }

  /**
   * Refresh access token
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Logout user
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Logout successful' };
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@CurrentUser() user: User) {
    const fullUser = await this.authService.getProfile(user.id);
    return {
      authenticated: true,
      userId: fullUser.id,
      email: fullUser.email,
      name: `${fullUser.firstName} ${fullUser.lastName}`,
      role: fullUser.role,
      isActive: fullUser.isActive,
      companyName: fullUser.companyName ?? null,
      phone: fullUser.phone ?? null,
    };
  }

  /**
   * Change password
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    // Validate new password matches confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.newPasswordConfirm) {
      throw new UnauthorizedException('New password and confirmation do not match');
    }

    const fullUser = await this.usersService.findOneWithPassword(user.id);

    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }

    // Validate current password
    const { comparePassword } = await import('../../common/utils');
    const isValid = await comparePassword(changePasswordDto.currentPassword, fullUser.password);

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password using UsersService
    await this.usersService.updatePassword(user.id, changePasswordDto.newPassword);
    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }
}
