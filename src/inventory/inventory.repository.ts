import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from '../products/schemas/product.schema.js';
import {
  Inventory,
  InventoryDocument,
} from './schemas/inventory.schema.js';

export interface InventoryProductLookup {
  _id: Types.ObjectId;
  title: string;
  category: string;
  price: number;
  thumbnail?: string;
}

export interface InventoryWithProductLookup {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sellerId: Types.ObjectId | null;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  product?: InventoryProductLookup;
}

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<Inventory>,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
  ) {}

  findAll(
    limit: number,
    skip: number,
  ): Promise<InventoryWithProductLookup[]> {
    return this.findPageWithProducts({}, limit, skip);
  }

  findBySellerId(
    sellerId: string,
    limit: number,
    skip: number,
  ): Promise<InventoryWithProductLookup[]> {
    return this.findPageWithProducts(
      { sellerId: new Types.ObjectId(sellerId) },
      limit,
      skip,
    );
  }

  private findPageWithProducts(
    filter: Record<string, Types.ObjectId>,
    limit: number,
    skip: number,
  ): Promise<InventoryWithProductLookup[]> {
    return this.inventoryModel
      .aggregate<InventoryWithProductLookup>([
        { $match: filter },
        { $sort: { updatedAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: this.productModel.collection.name,
            localField: 'productId',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  title: 1,
                  category: 1,
                  price: 1,
                  thumbnail: 1,
                },
              },
            ],
            as: 'product',
          },
        },
        {
          $unwind: {
            path: '$product',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            productId: 1,
            sellerId: 1,
            quantity: 1,
            createdAt: 1,
            updatedAt: 1,
            product: 1,
          },
        },
      ])
      .exec();
  }

  findByProductId(
    productId: string,
    sellerId?: string,
  ): Promise<InventoryDocument | null> {
    return this.inventoryModel
      .findOne({
        productId: new Types.ObjectId(productId),
        ...(sellerId && { sellerId: new Types.ObjectId(sellerId) }),
      })
      .exec();
  }

  findByProductIds(productIds: string[]): Promise<InventoryDocument[]> {
    if (productIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.inventoryModel
      .find({
        productId: {
          $in: productIds.map((id) => new Types.ObjectId(id)),
        },
      })
      .exec();
  }

  findProductsByIds(productIds: string[]): Promise<InventoryProductLookup[]> {
    if (productIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.productModel
      .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id title category price thumbnail')
      .lean<InventoryProductLookup[]>()
      .exec();
  }

  findProductByIdWithOwner(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).select('+createdBy').exec();
  }

  create(
    productId: string,
    sellerId: string | null,
    quantity: number,
  ): Promise<InventoryDocument> {
    return this.inventoryModel.create({
      productId: new Types.ObjectId(productId),
      sellerId: sellerId ? new Types.ObjectId(sellerId) : null,
      quantity,
    });
  }

  updateQuantity(
    productId: string,
    quantity: number,
    sellerId?: string,
  ): Promise<InventoryDocument | null> {
    return this.inventoryModel
      .findOneAndUpdate(
        {
          productId: new Types.ObjectId(productId),
          ...(sellerId && { sellerId: new Types.ObjectId(sellerId) }),
        },
        { $set: { quantity } },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.inventoryModel
      .deleteOne({ productId: new Types.ObjectId(productId) })
      .exec();
  }

  async migrateLegacyStock(): Promise<{
    migrated: number;
    skipped: number;
  }> {
    type LegacyProduct = {
      _id: Types.ObjectId;
      stock?: number;
      createdBy?: Types.ObjectId | string;
    };

    await this.inventoryModel.init();
    const legacyProducts = await this.productModel.collection
      .find({ stock: { $exists: true } })
      .project<LegacyProduct>({ _id: 1, stock: 1, createdBy: 1 })
      .toArray();
    const validProducts = legacyProducts.filter(
      (product): product is LegacyProduct & { stock: number } =>
        typeof product.stock === 'number' &&
        Number.isInteger(product.stock) &&
        product.stock >= 0,
    );
    const operations = validProducts.map((product) => ({
      updateOne: {
        filter: { productId: product._id },
        update: {
          $setOnInsert: {
            productId: product._id,
            sellerId:
              product.createdBy && Types.ObjectId.isValid(product.createdBy)
                ? product.createdBy
                : null,
            quantity: product.stock,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await this.inventoryModel.bulkWrite(operations);
      await this.productModel.collection.updateMany(
        {
          _id: { $in: validProducts.map((product) => product._id) },
        },
        { $unset: { stock: '' } },
      );
    }

    await this.productModel.collection.updateMany(
      { availabilityStatus: { $exists: true } },
      { $unset: { availabilityStatus: '' } },
    );

    return {
      migrated: validProducts.length,
      skipped: legacyProducts.length - validProducts.length,
    };
  }
}
