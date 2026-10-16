import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema.js';

@Injectable()
export class AuthRepository implements OnModuleInit {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
