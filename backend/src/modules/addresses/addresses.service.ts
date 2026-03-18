import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto, UpdateAddressDto, AddressResponseDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
  ) {}

  /**
   * Create a new address
   */
  async createAddress(
    userId: string,
    createAddressDto: CreateAddressDto,
  ): Promise<Address> {
    // If this is set as default, unset other defaults
    if (createAddressDto.isDefault) {
      await this.clearDefaultAddresses(userId);
    }

    const address = this.addressRepository.create({
      ...createAddressDto,
      userId,
    });

    const savedAddress = await this.addressRepository.save(address);
    this.logger.log(`Address created for user: ${userId}`);

    return savedAddress;
  }

  /**
   * Get all addresses for a user
   */
  async getAddresses(userId: string): Promise<Address[]> {
    return this.addressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get address by ID
   */
  async getAddressById(id: string, userId: string): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  /**
   * Get default address
   */
  async getDefaultAddress(userId: string): Promise<Address | null> {
    return this.addressRepository.findOne({
      where: { userId, isDefault: true },
    });
  }

  /**
   * Update address
   */
  async updateAddress(
    id: string,
    userId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.getAddressById(id, userId);

    // If setting as default, unset other defaults
    if (updateAddressDto.isDefault) {
      await this.clearDefaultAddresses(userId, id);
    }

    Object.assign(address, updateAddressDto);
    return this.addressRepository.save(address);
  }

  /**
   * Delete address
   */
  async deleteAddress(id: string, userId: string): Promise<void> {
    const address = await this.getAddressById(id, userId);
    await this.addressRepository.remove(address);
    this.logger.log(`Address deleted: ${id}`);
  }

  /**
   * Set address as default
   */
  async setDefaultAddress(id: string, userId: string): Promise<Address> {
    // First, clear all defaults
    await this.clearDefaultAddresses(userId);

    // Then set the new default
    const address = await this.getAddressById(id, userId);
    address.isDefault = true;
    return this.addressRepository.save(address);
  }

  /**
   * Clear all default addresses for a user
   */
  private async clearDefaultAddresses(userId: string, excludeId?: string): Promise<void> {
    const queryBuilder = this.addressRepository
      .createQueryBuilder()
      .update(Address)
      .set({ isDefault: false })
      .where('userId = :userId', { userId });

    if (excludeId) {
      queryBuilder.andWhere('id != :excludeId', { excludeId });
    }

    await queryBuilder.execute();
  }

  /**
   * Format address for display
   */
  formatAddressForDisplay(address: Address): string {
    return `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;
  }
}
