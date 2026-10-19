import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { FakePaymentGateway } from './fake-payment.gateway.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentStatus } from './schemas/payment.schema.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly fakePaymentGateway: FakePaymentGateway,
  ) {}

  async createSimulatedPayment(
    orderId: string,
    buyerId: string,
    amount: number,
    session: ClientSession,
  ) {
    const status = await this.fakePaymentGateway.charge();
    const payment = await this.paymentsRepository.create(
      {
        orderId: new Types.ObjectId(orderId),
        buyerId: new Types.ObjectId(buyerId),
        amount,
        currency: 'INR',
        status:
          status === 'simulated_succeeded'
            ? PaymentStatus.SIMULATED_SUCCEEDED
            : PaymentStatus.SIMULATED_FAILED,
        provider: 'fake',
        providerReference: null,
        idempotencyKey: `fake-order-${orderId}`,
      },
      session,
    );
    return payment;
  }

  async findMine(buyerId: string) {
    return this.paymentsRepository.findByBuyerId(buyerId);
  }

  async findOne(paymentId: string, buyerId: string) {
    const payment = await this.paymentsRepository.findOneForBuyer(
      paymentId,
      buyerId,
    );
    if (!payment) {
      throw new NotFoundException('Payment was not found');
    }
    return payment;
  }
}
