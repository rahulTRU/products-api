import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: false })
export class ProductDimensions {
  @Prop({ required: true, min: 0 })
  width!: number;

  @Prop({ required: true, min: 0 })
  height!: number;

  @Prop({ required: true, min: 0 })
  depth!: number;
}

export const ProductDimensionsSchema =
  SchemaFactory.createForClass(ProductDimensions);

@Schema({ _id: false })
export class ProductReview {
  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true, trim: true })
  comment!: string;

  @Prop({ required: true })
  date!: Date;

  @Prop({ required: true, trim: true })
  reviewerName!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  reviewerEmail!: string;
}

export const ProductReviewSchema = SchemaFactory.createForClass(ProductReview);

@Schema({ _id: false })
export class ProductMetadata {
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop({ trim: true })
  barcode?: string;

  @Prop({ trim: true })
  qrCode?: string;
}

export const ProductMetadataSchema =
  SchemaFactory.createForClass(ProductMetadata);

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Number, min: 1, unique: true, sparse: true })
  sourceId?: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    select: false,
  })
  createdBy!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  category!: string;

  @Prop({ default: '', trim: true })
  description!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ min: 0, max: 100 })
  discountPercentage?: number;

  @Prop({ min: 0, max: 5 })
  rating?: number;

  @Prop({ required: true, min: 0 })
  stock!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ trim: true })
  brand?: string;

  @Prop({ trim: true })
  sku?: string;

  @Prop({ min: 0 })
  weight?: number;

  @Prop({ type: ProductDimensionsSchema })
  dimensions?: ProductDimensions;

  @Prop({ trim: true })
  warrantyInformation?: string;

  @Prop({ trim: true })
  shippingInformation?: string;

  @Prop({ trim: true })
  availabilityStatus?: string;

  @Prop({ type: [ProductReviewSchema], default: [] })
  reviews!: ProductReview[];

  @Prop({ trim: true })
  returnPolicy?: string;

  @Prop({ min: 1 })
  minimumOrderQuantity?: number;

  @Prop({ type: ProductMetadataSchema })
  meta?: ProductMetadata;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ trim: true })
  thumbnail?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ category: 1 });
ProductSchema.index({ title: 1 });
ProductSchema.index({ updatedAt: 1 });
