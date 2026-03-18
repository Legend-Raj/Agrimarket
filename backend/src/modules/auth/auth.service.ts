import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';
import { LoginDto, RegisterDto, AuthResponseDto } from './dto/auth.dto';
import { hashPassword, comparePassword } from '../../common/utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (user && (await comparePassword(password, user.password))) {
      return user;
    }
    return null;
  }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, ...rest } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      ...rest,
    });

    await this.userRepository.save(user);

    // Generate tokens
    return this.generateTokens(user);
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save session
    await this.createSession(user.id, tokens.refreshToken, ipAddress, userAgent);

    return tokens;
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: User): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn') || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn') || '30d',
    });

    // Calculate expires in seconds (7 days = 604800 seconds)
    const expiresIn = 604800;

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
      },
    };
  }

  /**
   * Create session for user
   */
  private async createSession(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const session = this.sessionRepository.create({
      userId,
      token: refreshToken, // Store refresh token
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.sessionRepository.save(session);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      // Verify session exists and is valid
      const session = await this.sessionRepository.findOne({
        where: { refreshToken, isActive: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new access token
      const newAccessToken = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: this.configService.get('jwt.secret'),
          expiresIn: this.configService.get('jwt.expiresIn') || '7d',
        },
      );

      // Generate new refresh token
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: this.configService.get('jwt.refreshSecret'),
          expiresIn: this.configService.get('jwt.refreshExpiresIn') || '30d',
        },
      );

      // Update session with new refresh token
      session.refreshToken = newRefreshToken;
      session.token = newRefreshToken;
      await this.sessionRepository.save(session);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 604800,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    await this.sessionRepository.update(
      { refreshToken },
      { isActive: false },
    );
  }

  /**
   * Get current user
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
