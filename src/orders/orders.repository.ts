import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Address } from '../addresses/schemas/address.schema.js';
import { Business } from '../businesses/schemas/business.schema.js';
import { Cart, CartDocument } from '../carts/schemas/cart.schema.js';
import { Product } from '../products/schemas/product.schema.js';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from './schemas/order.schema.js';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
    @InjectModel(Address.name) private readonly addressModel: Model<Address>,
  ) {}

  findCart(buyerId: string, session: ClientSession): Promise<CartDocument | null> {
    return this.cartModel
      .findOne({ userId: new Types.ObjectId(buyerId) })
      .session(session)
      .exec();
  }

  findAddress(
    addressId: string,
    buyerId: string,
    session: ClientSession,
  ) {
    return this.addressModel
      .findOne({
        _id: new Types.ObjectId(addressId),
        userId: new Types.ObjectId(buyerId),
      })
      .session(session)
      .exec();
  }

  findAddresses(addressIds: Types.ObjectId[], session: ClientSession) {
    if (addressIds.length === 0) {
      return this.addressModel.find({ _id: { $in: [] } }).session(session).exec();
    }
    return this.addressModel
      .find({ _id: { $in: addressIds } })
      .session(session)
      .exec();
  }

  findProducts(productIds: string[], session: ClientSession) {
    return this.productModel
      .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id title sku price discountPercentage')
      .session(session)
      .exec();
  }

  findBusinesses(businessIds: string[], session: ClientSession) {
    return this.businessModel
      .find({
        _id: { $in: businessIds.map((id) => new Types.ObjectId(id)) },
      })
      .session(session)
      .exec();
  }

  create(
    order: Partial<Order>,
    session: ClientSession,
  ): Promise<OrderDocument> {
    return this.orderModel
      .create([order], { session })
      .then(([created]) => {
        if (!created) {
          throw new Error('Order creation did not return a document');
        }
        return created;
      });
  }

  findByBuyerId(buyerId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ buyerId: new Types.ObjectId(buyerId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  findOneForBuyer(
    orderId: string,
    buyerId: string,
  ): Promise<OrderDocument | null> {
    return this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        buyerId: new Types.ObjectId(buyerId),
      })
      .exec();
  }

  findOrdersForSeller(sellerId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({
        status: { $in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
        'sellerDeliveries.sellerId': new Types.ObjectId(sellerId),
      })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  clearCart(buyerId: string, session: ClientSession): Promise<unknown> {
    return this.cartModel
      .updateOne(
        { userId: new Types.ObjectId(buyerId) },
        { $set: { products: [] } },
        { session },
      )
      .exec();
  }
}
