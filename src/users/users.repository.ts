import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  updateLatestSelectedAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        new Types.ObjectId(userId),
        {
          $set: {
            latestSelectedAddressId: new Types.ObjectId(addressId),
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }
}
