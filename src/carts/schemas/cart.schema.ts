import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ _id: false })
export class CartProduct {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;
}

export const CartProductSchema = SchemaFactory.createForClass(CartProduct);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Cart {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: [CartProductSchema], default: [] })
  products!: CartProduct[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
CartSchema.index({ userId: 1 }, { unique: true });
