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
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  private readonly logger = new Logger(AddressesController.name);

  constructor(private readonly addressesService: AddressesService) {}

  /**
   * Create a new address
   */
  @Post()
  @ApiOperation({ summary: 'Create a new address' })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  async createAddress(
    @CurrentUser() user: User,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.createAddress(user.id, createAddressDto);
  }

  /**
   * Get all addresses
   */
  @Get()
  @ApiOperation({ summary: 'Get all addresses for current user' })
  @ApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  async getAddresses(@CurrentUser() user: User) {
    return this.addressesService.getAddresses(user.id);
  }

  /**
   * Get default address
   */
  @Get('default')
  @ApiOperation({ summary: 'Get default address' })
  @ApiResponse({ status: 200, description: 'Default address retrieved' })
  async getDefaultAddress(@CurrentUser() user: User) {
    const address = await this.addressesService.getDefaultAddress(user.id);
    return address || { message: 'No default address set' };
  }

  /**
   * Get address by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get address by ID' })
  @ApiResponse({ status: 200, description: 'Address found' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async getAddressById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.addressesService.getAddressById(id, user.id);
  }

  /**
   * Update address
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update an address' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(id, user.id, updateAddressDto);
  }

  /**
   * Delete address
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiResponse({ status: 204, description: 'Address deleted successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async deleteAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.addressesService.deleteAddress(id, user.id);
  }

  /**
   * Set address as default
   */
  @Put(':id/default')
  @ApiOperation({ summary: 'Set address as default' })
  @ApiResponse({ status: 200, description: 'Address set as default' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async setDefaultAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.addressesService.setDefaultAddress(id, user.id);
  }
}
