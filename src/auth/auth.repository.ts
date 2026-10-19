import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { Address } from '../addresses/schemas/address.schema.js';
import { Business } from '../businesses/schemas/business.schema.js';

export interface AddressSummary {
  _id: string;
  formattedAddress: string;
}

export interface BusinessAddressSummary {
  id: string;
  formattedAddress: string;
}

export interface BusinessSummary {
  id: string;
  businessName: string;
  addresses: BusinessAddressSummary[];
}

@Injectable()
export class AuthRepository implements OnModuleInit {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Address.name) private readonly addressModel: Model<Address>,
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.userModel.init();

    const indexes = await this.userModel.collection.indexes();
    const numericIdIndexes = indexes.filter(
      (index) => Object.keys(index.key).length === 1 && index.key.id === 1,
    );
    for (const index of numericIdIndexes) {
      if (index.name) {
        await this.userModel.collection.dropIndex(index.name);
      }
    }

    const result = await this.userModel.collection.updateMany(
      { id: { $exists: true } },
      { $unset: { id: '' } },
    );
    if (result.modifiedCount > 0 || numericIdIndexes.length > 0) {
      this.logger.log(
        `Removed legacy numeric IDs from ${result.modifiedCount} user(s)`,
      );
    }

    await this.userModel.collection.updateMany(
      { latestSelectedAddressId: { $exists: false } },
      { $set: { latestSelectedAddressId: null } },
    );
  }

  createUser(
    user: Pick<
      User,
      | 'username'
      | 'email'
      | 'passwordHash'
      | 'firstName'
      | 'lastName'
      | 'gender'
      | 'role'
      | 'image'
    >,
  ): Promise<UserDocument> {
    return this.userModel.create(user);
  }

  existsByUsernameOrEmail(username: string, email: string): Promise<boolean> {
    return this.userModel
      .exists({ $or: [{ username }, { email }] })
      .then((user) => user !== null);
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();
  }

  findByIdWithRefreshTokenHash(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+refreshTokenHash')
      .exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findOwnedAddressSummary(
    addressId: string,
    userId: string,
  ): Promise<AddressSummary | null> {
    return this.addressModel
      .findOne({ _id: addressId, userId })
      .select('_id formattedAddress')
      .lean<AddressSummary>()
      .exec();
  }

  async findBusinessSummariesForOwner(
    userId: string,
  ): Promise<BusinessSummary[]> {
    const businesses = await this.businessModel
      .find({ ownerId: new Types.ObjectId(userId) })
      .select('_id businessName addressIds')
      .lean<
        {
          _id: Types.ObjectId;
          businessName: string;
          addressIds: Types.ObjectId[];
        }[]
      >()
      .exec();
    const addressIds = businesses.flatMap((business) => business.addressIds);
    const addresses =
      addressIds.length === 0
        ? []
        : await this.addressModel
            .find({
              _id: { $in: addressIds },
              userId: new Types.ObjectId(userId),
            })
            .select('_id formattedAddress')
            .lean<{ _id: Types.ObjectId; formattedAddress: string }[]>()
            .exec();
    const addressesById = new Map(
      addresses.map((address) => [
        address._id.toString(),
        {
          id: address._id.toString(),
          formattedAddress: address.formattedAddress,
        },
      ]),
    );
    return businesses.map((business) => ({
      id: business._id.toString(),
      businessName: business.businessName,
      addresses: business.addressIds.flatMap((addressId) => {
        const address = addressesById.get(addressId.toString());
        return address ? [address] : [];
      }),
    }));
  }

  async clearRefreshTokenHash(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $set: { refreshTokenHash: null } })
      .exec();
  }

  async updateRefreshTokenHash(
    user: UserDocument,
    refreshTokenHash: string,
    expectedRefreshHash?: string,
  ): Promise<boolean> {
    const filter = expectedRefreshHash
      ? { _id: user._id, refreshTokenHash: expectedRefreshHash }
      : { _id: user._id };
    const result = await this.userModel
      .updateOne(filter, { $set: { refreshTokenHash } })
      .exec();
    return result.modifiedCount === 1;
  }
}
