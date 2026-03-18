import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserQueryDto } from './dto/user.dto';
import { hashPassword } from '../../common/utils';
import { UserRole } from '../../common/enums';
import { PAGINATION } from '../../common/constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(createUserDto.password);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User created: ${savedUser.email}`);

    return this.toResponseDto(savedUser);
  }

  /**
   * Find all users with pagination
   */
  async findAll(query: UserQueryDto): Promise<{ users: UserResponseDto[]; total: number }> {
    const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, role, isActive, search } = query;

    const where: FindOptionsWhere<User> = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      // Use OR condition for search
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      if (role) queryBuilder.andWhere('user.role = :role', { role });
      if (isActive !== undefined) queryBuilder.andWhere('user.isActive = :isActive', { isActive });

      queryBuilder.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );

      queryBuilder.skip((page - 1) * limit).take(limit).orderBy('user.createdAt', 'DESC');

      const [users, total] = await queryBuilder.getManyAndCount();

      return {
        users: users.map(u => this.toResponseDto(u)),
        total,
      };
    }

    const [users, total] = await this.userRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      users: users.map(u => this.toResponseDto(u)),
      total,
    };
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.toResponseDto(user);
  }

  /**
   * Find user by ID with password (internal use only)
   */
  async findOneWithPassword(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.password = await hashPassword(newPassword);
    await this.userRepository.save(user);
    this.logger.log(`Password updated for user: ${user.email}`);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If updating email, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    // If updating password, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await hashPassword(updateUserDto.password);
    }

    // Update user
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`User updated: ${updatedUser.email}`);

    return this.toResponseDto(updatedUser);
  }

  /**
   * Soft delete user
   */
  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft delete (deactivate)
    user.isActive = false;
    await this.userRepository.save(user);
    this.logger.log(`User deactivated: ${user.email}`);
  }

  /**
   * Get user count by role
   */
  async getCountByRole(): Promise<{ role: UserRole; count: number }[]> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return result;
  }

  /**
   * Convert User entity to response DTO
   */
  private toResponseDto(user: User): UserResponseDto {
    const { password, ...result } = user;
    return result as UserResponseDto;
  }
}
