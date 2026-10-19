import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AddressDocument = HydratedDocument<Address>;

@Schema({ _id: false })
export class AddressComponents {
  @Prop({ trim: true })
  streetNumber?: string;

  @Prop({ trim: true })
  route?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  postalCode?: string;

  @Prop({ trim: true, uppercase: true })
  country?: string;
}

export const AddressComponentsSchema =
  SchemaFactory.createForClass(AddressComponents);

@Schema({ _id: false })
export class AddressLocation {
  @Prop({ type: String, required: true, enum: ['Point'], default: 'Point' })
  type!: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

export const AddressLocationSchema =
  SchemaFactory.createForClass(AddressLocation);

@Schema({ _id: false })
export class AddressMetadata {
  @Prop({ trim: true })
  rawUserInput?: string;

  @Prop({ type: Boolean, default: false })
  isVerified!: boolean;
}

export const AddressMetadataSchema =
  SchemaFactory.createForClass(AddressMetadata);

@Schema({ timestamps: true, id: false, versionKey: false })
export class Address {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({ trim: true })
  googlePlaceId?: string;

  @Prop({ required: true, trim: true })
  formattedAddress!: string;

  @Prop({ type: AddressComponentsSchema })
  components?: AddressComponents;

  @Prop({ type: AddressLocationSchema })
  location?: AddressLocation;

  @Prop({ type: AddressMetadataSchema })
  metadata?: AddressMetadata;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
AddressSchema.index({ userId: 1, createdAt: -1, _id: -1 });
