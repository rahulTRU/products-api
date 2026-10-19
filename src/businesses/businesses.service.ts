import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AddressesService } from '../addresses/addresses.service.js';
import { User } from '../users/schemas/user.schema.js';
import { Inventory } from '../inventory/schemas/inventory.schema.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { BusinessesRepository } from './businesses.repository.js';
import type { BusinessDocument } from './schemas/business.schema.js';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businessesRepository: BusinessesRepository,
    private readonly addressesService: AddressesService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<Inventory>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findMine(user: AuthPrincipal) {
    const businesses = await this.businessesRepository.findByOwner(user.id);
    return Promise.all(
      businesses.map((business) => this.toResponse(business, user)),
    );
  }

  async findOne(businessId: string, user: AuthPrincipal) {
    const business = await this.findBusiness(businessId, user.id);
    return this.toResponse(business, user);
  }

  async create(dto: CreateBusinessDto, user: AuthPrincipal) {
    await this.validateAddresses(dto.addressIds, user);
    const session = await this.connection.startSession();
    let business: BusinessDocument | null = null;
    try {
      await session.withTransaction(async () => {
        business = await this.businessesRepository.create(
          user.id,
          dto.businessName.trim(),
          dto.addressIds,
          session,
        );
        const result = await this.userModel.updateOne(
          { _id: new Types.ObjectId(user.id) },
          { $set: { sellerEnabled: true } },
          { session },
        );
        if (result.matchedCount !== 1) {
          throw new NotFoundException('User was not found');
        }
      });
    } finally {
      await session.endSession();
    }
    if (!business) {
      throw new Error('Business transaction completed without a business');
    }
    return {
      ...(await this.toResponse(business, user)),
      sellerEnabled: true,
      accessTokenRefreshRequired: true,
    };
  }

  async update(
    businessId: string,
    dto: UpdateBusinessDto,
    user: AuthPrincipal,
  ) {
    if (dto.addressIds) {
      await this.validateAddresses(dto.addressIds, user);
    }
    const business = await this.businessesRepository.updateForOwner(
      businessId,
      user.id,
      {
        ...(dto.businessName !== undefined && {
          businessName: dto.businessName.trim(),
        }),
        ...(dto.addressIds && { addressIds: dto.addressIds }),
      },
    );
    if (!business) {
      throw new NotFoundException('Business was not found');
    }
    return this.toResponse(business, user);
  }

  async remove(businessId: string, user: AuthPrincipal): Promise<void> {
    const business = await this.findBusiness(businessId, user.id);
    if (
      await this.inventoryModel.exists({
        businessId: new Types.ObjectId(businessId),
      })
    ) {
      throw new ConflictException(
        'Remove this business’s product offers before deleting it',
      );
    }
    const deleted = await this.businessesRepository.deleteForOwner(
      businessId,
      user.id,
    );
    if (!deleted || !business) {
      throw new NotFoundException('Business was not found');
    }
  }

  private async findBusiness(
    businessId: string,
    userId: string,
  ): Promise<BusinessDocument> {
    const business = await this.businessesRepository.findOneForOwner(
      businessId,
      userId,
    );
    if (!business) {
      throw new NotFoundException('Business was not found');
    }
    return business;
  }

  private async validateAddresses(addressIds: string[], user: AuthPrincipal) {
    const uniqueIds = new Set(addressIds);
    if (uniqueIds.size !== addressIds.length) {
      throw new NotFoundException('Business addresses must be unique');
    }
    for (const addressId of addressIds) {
      await this.addressesService.findOne(addressId, user);
    }
  }

  private async toResponse(business: BusinessDocument, user: AuthPrincipal) {
    const addresses = await Promise.all(
      business.addressIds.map((addressId) =>
        this.addressesService.findOne(addressId.toString(), user),
      ),
    );
    return {
      id: business._id.toString(),
      ownerId: business.ownerId.toString(),
      businessName: business.businessName,
      addressIds: business.addressIds.map((addressId) =>
        addressId.toString(),
      ),
      addresses: addresses.map((address) => ({
        id: String(address._id),
        formattedAddress: address.formattedAddress,
      })),
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }
}
