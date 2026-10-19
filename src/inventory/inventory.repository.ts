import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
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
  businessId: Types.ObjectId | null;
  unitPrice?: number;
  quantity: number;
  reservedQuantity: number;
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

  findByBusinessIds(
    businessIds: string[],
    limit: number,
    skip: number,
  ): Promise<InventoryWithProductLookup[]> {
    return this.findPageWithProducts(
      { businessId: { $in: businessIds.map((id) => new Types.ObjectId(id)) } },
      limit,
      skip,
    );
  }

  private findPageWithProducts(
    filter: Record<string, unknown>,
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
            businessId: 1,
            unitPrice: 1,
            quantity: 1,
            reservedQuantity: 1,
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
    businessId?: string,
  ): Promise<InventoryDocument | null> {
    return this.inventoryModel
      .findOne({
        productId: new Types.ObjectId(productId),
        ...(businessId && { businessId: new Types.ObjectId(businessId) }),
      })
      .exec();
  }

  findOffersByProductId(productId: string): Promise<InventoryDocument[]> {
    return this.inventoryModel
      .find({
        productId: new Types.ObjectId(productId),
        businessId: { $ne: null },
      })
      .sort({ unitPrice: 1, _id: 1 })
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
        businessId: { $ne: null },
      })
      .exec();
  }

  findBusinessIdsByOwner(ownerId: string): Promise<string[]> {
    return this.inventoryModel
      .distinct('businessId', {
        sellerId: new Types.ObjectId(ownerId),
        businessId: { $ne: null },
      })
      .exec()
      .then((ids) => ids.map((id) => String(id)));
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
    businessId: string,
    sellerId: string,
    unitPrice: number,
    quantity: number,
  ): Promise<InventoryDocument> {
    return this.inventoryModel.create({
      productId: new Types.ObjectId(productId),
      businessId: new Types.ObjectId(businessId),
      sellerId: new Types.ObjectId(sellerId),
      unitPrice,
      quantity,
      reservedQuantity: 0,
    });
  }

  updateQuantity(
    productId: string,
    businessId: string,
    quantity: number,
    unitPrice?: number,
  ): Promise<InventoryDocument | null> {
    return this.inventoryModel
      .findOneAndUpdate(
        {
          productId: new Types.ObjectId(productId),
          businessId: new Types.ObjectId(businessId),
          reservedQuantity: { $lte: quantity },
        },
        {
          $set: {
            quantity,
            ...(unitPrice !== undefined && { unitPrice }),
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  async reserve(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.inventoryModel
      .updateOne(
        {
          productId: new Types.ObjectId(productId),
          businessId: new Types.ObjectId(businessId),
          $expr: {
            $gte: [
              { $subtract: ['$quantity', '$reservedQuantity'] },
              quantity,
            ],
          },
        },
        { $inc: { reservedQuantity: quantity } },
      )
      .session(session)
      .exec();
    return result.modifiedCount === 1;
  }

  async releaseReservation(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.inventoryModel
      .updateOne(
        {
          productId: new Types.ObjectId(productId),
          businessId: new Types.ObjectId(businessId),
          reservedQuantity: { $gte: quantity },
        },
        { $inc: { reservedQuantity: -quantity } },
      )
      .session(session)
      .exec();
    return result.modifiedCount === 1;
  }

  async commitReservation(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.inventoryModel
      .updateOne(
        {
          productId: new Types.ObjectId(productId),
          businessId: new Types.ObjectId(businessId),
          quantity: { $gte: quantity },
          reservedQuantity: { $gte: quantity },
        },
        { $inc: { quantity: -quantity, reservedQuantity: -quantity } },
      )
      .session(session)
      .exec();
    return result.modifiedCount === 1;
  }

  async findOneOffer(
    productId: string,
    businessId: string,
    session?: ClientSession,
  ): Promise<InventoryDocument | null> {
    const query = this.inventoryModel
      .findOne({
        productId: new Types.ObjectId(productId),
        businessId: new Types.ObjectId(businessId),
      });
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.inventoryModel
      .deleteMany({ productId: new Types.ObjectId(productId) })
      .exec();
  }

  async deleteOffer(productId: string, businessId: string): Promise<boolean> {
    const result = await this.inventoryModel
      .deleteOne({
        productId: new Types.ObjectId(productId),
        businessId: new Types.ObjectId(businessId),
      })
      .exec();
    return result.deletedCount === 1;
  }

  hasOffersForProduct(productId: string): Promise<boolean> {
    return this.inventoryModel
      .exists({
        productId: new Types.ObjectId(productId),
        businessId: { $ne: null },
      })
      .then((exists) => exists !== null);
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
    const indexes = await this.inventoryModel.collection.indexes();
    const oldUniqueProductIndex = indexes.find(
      (index) =>
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key.productId === 1,
    );
    if (oldUniqueProductIndex?.name) {
      await this.inventoryModel.collection.dropIndex(
        oldUniqueProductIndex.name,
      );
    }
    await this.inventoryModel.collection.updateMany(
      { reservedQuantity: { $exists: false } },
      { $set: { reservedQuantity: 0 } },
    );
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
