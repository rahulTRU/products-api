import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BusinessDocument = HydratedDocument<Business>;

@Schema({ timestamps: true, id: false, versionKey: false })
export class Business {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  businessName!: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Address' }],
    required: true,
    validate: {
      validator: (addressIds: Types.ObjectId[]) => addressIds.length > 0,
      message: 'At least one delivery address is required',
    },
  })
  addressIds!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
BusinessSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });
