import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Address, AddressDocument } from './schemas/address.schema.js';
import { Business } from '../businesses/schemas/business.schema.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

@Injectable()
export class AddressesRepository {
  constructor(
    @InjectModel(Address.name)
    private readonly addressModel: Model<Address>,
    @InjectModel(Business.name)
    private readonly businessModel: Model<Business>,
  ) {}

  findByUserId(userId: string): Promise<AddressDocument[]> {
    return this.addressModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  findOneForUser(
    addressId: string,
    userId: string,
  ): Promise<AddressDocument | null> {
    return this.addressModel
      .findOne({
        _id: new Types.ObjectId(addressId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }

  findSummariesForUser(
    addressIds: string[],
    userId: string,
  ): Promise<
    Pick<AddressDocument, '_id' | 'formattedAddress' | 'components'>[]
  > {
    if (addressIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.addressModel
      .find({
        _id: { $in: addressIds.map((id) => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(userId),
      })
      .select('_id formattedAddress components')
      .exec();
  }

  create(userId: string, dto: CreateAddressDto): Promise<AddressDocument> {
    return this.addressModel.create(
      Object.assign({}, dto, {
        userId: new Types.ObjectId(userId),
      }),
    );
  }

  updateForUser(
    addressId: string,
    userId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressDocument | null> {
    return this.addressModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(addressId),
          userId: new Types.ObjectId(userId),
        },
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  deleteForUser(addressId: string, userId: string): Promise<boolean> {
    return this.addressModel
      .deleteOne({
        _id: new Types.ObjectId(addressId),
        userId: new Types.ObjectId(userId),
      })
      .exec()
      .then((result) => result.deletedCount === 1);
  }

  isUsedByBusiness(addressId: string): Promise<boolean> {
    return this.businessModel
      .exists({ addressIds: new Types.ObjectId(addressId) })
      .then((business) => business !== null);
  }
}
