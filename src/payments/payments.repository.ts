import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema.js';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  async create(
    payment: Omit<Payment, '_id' | 'createdAt' | 'updatedAt'>,
    session: ClientSession,
  ): Promise<PaymentDocument> {
    const [created] = await this.paymentModel.create([payment], { session });
    if (!created) {
      throw new Error('Payment creation did not return a document');
    }
    return created;
  }

  findByBuyerId(buyerId: string): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({ buyerId: new Types.ObjectId(buyerId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  findOneForBuyer(
    paymentId: string,
    buyerId: string,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOne({
        _id: new Types.ObjectId(paymentId),
        buyerId: new Types.ObjectId(buyerId),
      })
      .exec();
  }
}
