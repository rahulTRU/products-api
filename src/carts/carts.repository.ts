import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema.js';
import { Business } from '../businesses/schemas/business.schema.js';
import { Cart, CartDocument } from './schemas/cart.schema.js';

@Injectable()
export class CartsRepository {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
  ) {}

  findAll(limit: number, skip: number): Promise<CartDocument[]> {
    return this.cartModel
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  findByUserId(userId: string): Promise<CartDocument | null> {
    return this.cartModel.findOne({ userId }).exec();
  }

  async findOrCreateByUserId(userId: string): Promise<CartDocument> {
    const ownerId = new Types.ObjectId(userId);
    try {
      const cart = await this.cartModel
        .findOneAndUpdate(
          { userId: ownerId },
          { $setOnInsert: { userId: ownerId, products: [] } },
          { upsert: true, returnDocument: 'after' },
        )
        .exec();
      if (!cart) {
        throw new Error('Cart upsert did not return a document');
      }
      return cart;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const cart = await this.findByUserId(userId);
      if (!cart) {
        throw error;
      }
      return cart;
    }
  }

  async putProductQuantity(
    cart: CartDocument,
    productId: string,
    businessId: string,
    quantity: number,
  ): Promise<CartDocument> {
    const normalizedProductId = new Types.ObjectId(productId).toString();
    const normalizedBusinessId = new Types.ObjectId(businessId).toString();
    const existingProduct = cart.products.find(
      (entry) =>
        entry.productId.toString() === normalizedProductId &&
        entry.businessId?.toString() === normalizedBusinessId,
    );
    if (existingProduct) {
      existingProduct.quantity = quantity;
    } else {
      cart.products.push({
        productId: new Types.ObjectId(normalizedProductId),
        businessId: new Types.ObjectId(normalizedBusinessId),
        quantity,
      });
    }
    return cart.save();
  }

  async removeProduct(
    cart: CartDocument,
    productId: string,
    businessId: string,
  ): Promise<CartDocument | null> {
    const normalizedProductId = new Types.ObjectId(productId).toString();
    const normalizedBusinessId = new Types.ObjectId(businessId).toString();
    const index = cart.products.findIndex(
      (entry) =>
        entry.productId.toString() === normalizedProductId &&
        entry.businessId?.toString() === normalizedBusinessId,
    );
    if (index === -1) {
      return null;
    }
    cart.products.splice(index, 1);
    return cart.save();
  }

  findProductById(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  findProductsByIds(ids: string[]): Promise<ProductDocument[]> {
    return this.productModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .exec();
  }

  findBusinessesByIds(ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.businessModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('_id businessName')
      .exec();
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
