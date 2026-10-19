import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { Types } from 'mongoose';
import type { Address } from './schemas/address.schema.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';
import { AddressesRepository } from './addresses.repository.js';
import type { AddressDocument } from './schemas/address.schema.js';

export type AddressResponse = Address & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}

  async findAll(user: AuthPrincipal): Promise<AddressResponse[]> {
    const addresses = await this.addressesRepository.findByUserId(user.id);
    return addresses.map(toAddressResponse);
  }

  async findSummariesForUser(addressIds: string[], userId: string) {
    return this.addressesRepository.findSummariesForUser(addressIds, userId);
  }

  async findOne(
    addressId: string,
    user: AuthPrincipal,
  ): Promise<AddressResponse> {
    const address = await this.addressesRepository.findOneForUser(
      addressId,
      user.id,
    );
    if (!address) {
      throw new NotFoundException('Address was not found');
    }
    return toAddressResponse(address);
  }

  async create(
    dto: CreateAddressDto,
    user: AuthPrincipal,
  ): Promise<AddressResponse> {
    return toAddressResponse(
      await this.addressesRepository.create(user.id, dto),
    );
  }

  async update(
    addressId: string,
    dto: UpdateAddressDto,
    user: AuthPrincipal,
  ): Promise<AddressResponse> {
    const address = await this.addressesRepository.updateForUser(
      addressId,
      user.id,
      dto,
    );
    if (!address) {
      throw new NotFoundException('Address was not found');
    }
    return toAddressResponse(address);
  }

  async remove(addressId: string, user: AuthPrincipal): Promise<void> {
    const address = await this.addressesRepository.findOneForUser(
      addressId,
      user.id,
    );
    if (!address) {
      throw new NotFoundException('Address was not found');
    }
    if (await this.addressesRepository.isUsedByBusiness(addressId)) {
      throw new ConflictException(
        'Remove this address from its business service areas before deleting it',
      );
    }
    const deleted = await this.addressesRepository.deleteForUser(
      addressId,
      user.id,
    );
    if (!deleted) {
      throw new NotFoundException('Address was not found');
    }
  }
}

function toAddressResponse(address: AddressDocument): AddressResponse {
  return address.toObject() as AddressResponse;
}
