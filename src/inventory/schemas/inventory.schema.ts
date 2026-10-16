import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type InventoryDocument = HydratedDocument<Inventory>;

@Schema({ timestamps: true })
export class Inventory {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  sellerId!: Types.ObjectId | null;

  @Prop({ required: true, min: 0, default: 0 })
  quantity!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ productId: 1 }, { unique: true });
InventorySchema.index({ updatedAt: -1, _id: -1 });
InventorySchema.index({ sellerId: 1, updatedAt: -1, _id: -1 });
