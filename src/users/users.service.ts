import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AddressesService } from '../addresses/addresses.service.js';
import { SelectLatestAddressDto } from './dto/select-latest-address.dto.js';
import { UsersRepository } from './users.repository.js';

export interface LatestSelectedAddressResponse {
  latestSelectedAddressId: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly addressesService: AddressesService,
  ) {}

  async selectLatestAddress(
    dto: SelectLatestAddressDto,
    user: AuthPrincipal,
  ): Promise<LatestSelectedAddressResponse> {
    try {
      await this.addressesService.findOne(dto.addressId, user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Address was not found for this user');
      }
      throw error;
    }

    const updatedUser =
      await this.usersRepository.updateLatestSelectedAddress(
        user.id,
        dto.addressId,
      );
    if (!updatedUser) {
      throw new NotFoundException('User was not found');
    }
    if (!updatedUser.latestSelectedAddressId) {
      throw new Error('User address update did not return the selected address');
    }
    return {
      latestSelectedAddressId:
        updatedUser.latestSelectedAddressId.toString(),
    };
  }
}
