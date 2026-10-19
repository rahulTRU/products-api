import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  SIMULATED_SUCCEEDED = 'simulated_succeeded',
  SIMULATED_FAILED = 'simulated_failed',
}

@Schema({ timestamps: true, id: false, versionKey: false })
export class Payment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  buyerId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, enum: ['INR'], default: 'INR' })
  currency!: 'INR';

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PaymentStatus),
  })
  status!: PaymentStatus;

  @Prop({ type: String, required: true, enum: ['fake'], default: 'fake' })
  provider!: 'fake';

  @Prop({ type: String, default: null })
  providerReference!: string | null;

  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
