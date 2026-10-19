import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Business, BusinessDocument } from './schemas/business.schema.js';

@Injectable()
export class BusinessesRepository {
  constructor(
    @InjectModel(Business.name)
    private readonly businessModel: Model<Business>,
  ) {}

  findByOwner(ownerId: string): Promise<BusinessDocument[]> {
    return this.businessModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  findOneForOwner(
    businessId: string,
    ownerId: string,
  ): Promise<BusinessDocument | null> {
    return this.businessModel
      .findOne({
        _id: new Types.ObjectId(businessId),
        ownerId: new Types.ObjectId(ownerId),
      })
      .exec();
  }

  findById(businessId: string): Promise<BusinessDocument | null> {
    return this.businessModel
      .findById(new Types.ObjectId(businessId))
      .exec();
  }

  create(
    ownerId: string,
    businessName: string,
    addressIds: string[],
    session: ClientSession,
  ): Promise<BusinessDocument> {
    return this.businessModel
      .create(
        [
          {
            ownerId: new Types.ObjectId(ownerId),
            businessName,
            addressIds: addressIds.map((id) => new Types.ObjectId(id)),
          },
        ],
        { session },
      )
      .then(([business]) => {
        if (!business) {
          throw new Error('Business creation did not return a document');
        }
        return business;
      });
  }

  updateForOwner(
    businessId: string,
    ownerId: string,
    update: { businessName?: string; addressIds?: string[] },
  ): Promise<BusinessDocument | null> {
    return this.businessModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(businessId),
          ownerId: new Types.ObjectId(ownerId),
        },
        {
          $set: {
            ...update,
            ...(update.addressIds && {
              addressIds: update.addressIds.map((id) => new Types.ObjectId(id)),
            }),
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  deleteForOwner(businessId: string, ownerId: string): Promise<boolean> {
    return this.businessModel
      .deleteOne({
        _id: new Types.ObjectId(businessId),
        ownerId: new Types.ObjectId(ownerId),
      })
      .exec()
      .then((result) => result.deletedCount === 1);
  }
}
