import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  PAYMENT_FAILED = 'payment_failed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum SellerDeliveryStatus {
  AWAITING_PAYMENT = 'awaiting_payment',
  PREPARING = 'preparing',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  UNABLE_TO_FULFILL = 'unable_to_fulfill',
  CANCELLED = 'cancelled',
}

@Schema({ _id: false })
export class OrderLocationSnapshot {
  @Prop({ type: String, required: true, enum: ['Point'], default: 'Point' })
  type!: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

export const OrderLocationSnapshotSchema =
  SchemaFactory.createForClass(OrderLocationSnapshot);

@Schema({ _id: false })
export class OrderAddressSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Address' })
  addressId!: Types.ObjectId;

  @Prop({ required: true })
  formattedAddress!: string;

  @Prop({ type: OrderLocationSnapshotSchema })
  location?: OrderLocationSnapshot;
}

export const OrderAddressSnapshotSchema =
  SchemaFactory.createForClass(OrderAddressSnapshot);

@Schema()
export class OrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Inventory', required: true })
  inventoryId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: '' })
  sku!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ required: true, min: 0, max: 100, default: 0 })
  discountPercentage!: number;

  @Prop({ required: true, min: 0 })
  lineTotal!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class SellerAddressSnapshot {
  @Prop({ required: true })
  formattedAddress!: string;

  @Prop({ type: OrderLocationSnapshotSchema })
  location?: OrderLocationSnapshot;
}

export const SellerAddressSnapshotSchema =
  SchemaFactory.createForClass(SellerAddressSnapshot);

@Schema()
export class SellerDelivery {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Business',
    required: true,
  })
  businessId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  businessName!: string;

  @Prop({ type: [SellerAddressSnapshotSchema], default: [] })
  businessAddresses!: SellerAddressSnapshot[];

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SellerDeliveryStatus),
  })
  status!: SellerDeliveryStatus;

  @Prop({ type: [OrderItemSchema], default: [] })
  items!: OrderItem[];

  @Prop({ required: true, min: 0 })
  grossAmount!: number;

  @Prop({ type: String, required: true, enum: ['INR'], default: 'INR' })
  currency!: 'INR';
}

export const SellerDeliverySchema = SchemaFactory.createForClass(SellerDelivery);

@Schema({ _id: false })
export class OrderDeliveryWindow {
  @Prop({ required: true })
  startsAt!: Date;

  @Prop({ required: true })
  endsAt!: Date;

  @Prop({ required: true })
  timeZone!: string;
}

export const OrderDeliveryWindowSchema =
  SchemaFactory.createForClass(OrderDeliveryWindow);

@Schema({ timestamps: true, id: false, versionKey: false })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  buyerId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(OrderStatus),
  })
  status!: OrderStatus;

  @Prop({ type: OrderAddressSnapshotSchema, required: true })
  deliveryAddress!: OrderAddressSnapshot;

  @Prop({ type: OrderDeliveryWindowSchema, required: true })
  deliveryWindow!: OrderDeliveryWindow;

  @Prop({ type: [SellerDeliverySchema], required: true })
  sellerDeliveries!: SellerDelivery[];

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ type: String, required: true, enum: ['INR'], default: 'INR' })
  currency!: 'INR';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment', default: null })
  paymentId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  paymentStatus!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ 'sellerDeliveries.sellerId': 1, createdAt: -1 });
