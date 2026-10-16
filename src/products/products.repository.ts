import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product, ProductDocument } from './schemas/product.schema.js';

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
  ) {}

  findAll(): Promise<ProductDocument[]> {
    return this.productModel.find().exec();
  }

  findById(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  create(product: CreateProductDto): Promise<ProductDocument> {
    return this.productModel.create(product);
  }

  update(
    id: string,
    product: UpdateProductDto,
  ): Promise<ProductDocument | null> {
    return this.productModel
      .findByIdAndUpdate(id, product, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
  }

  delete(id: string): Promise<ProductDocument | null> {
    return this.productModel.findByIdAndDelete(id).exec();
  }
}
