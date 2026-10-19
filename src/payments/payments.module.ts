import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsController } from './payments.controller.js';
import { FakePaymentGateway } from './fake-payment.gateway.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentsService } from './payments.service.js';
import { Payment, PaymentSchema } from './schemas/payment.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, FakePaymentGateway, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
