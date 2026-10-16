import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product, ProductDocument } from './schemas/product.schema.js';

type ProductListFilters = Omit<ListProductsQueryDto, 'limit' | 'offset'>;

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
  ) {}

  findAll(
    filters: ProductListFilters,
    limit: number,
    offset: number,
  ): Promise<ProductDocument[]> {
    return this.findWithFilter(
      this.buildFilter(filters),
      filters,
      limit,
      offset,
    );
  }

  findMine(
    userId: string,
    filters: ProductListFilters,
    limit: number,
    offset: number,
  ): Promise<ProductDocument[]> {
    return this.findWithFilter(
      {
        ...this.buildFilter(filters),
        createdBy: new Types.ObjectId(userId),
      },
      filters,
      limit,
      offset,
    );
  }

  async findCategories(): Promise<string[]> {
    const categories = await this.productModel
      .distinct<'category'>('category')
      .exec();
    return categories.sort((left, right) => left.localeCompare(right));
  }

  async existsInCategory(category: string): Promise<boolean> {
    return (
      (await this.productModel.exists({
        category: category.trim().toLowerCase(),
      })) !== null
    );
  }

  findById(id: string): Promise<ProductDocument | null> {
    return this.productModel.findById(id).exec();
  }

  create(product: CreateProductDto, userId: string): Promise<ProductDocument> {
    return this.productModel.create(
      Object.assign({}, product, {
        createdBy: new Types.ObjectId(userId),
      }),
    );
  }

  update(
    id: string,
    product: UpdateProductDto,
    userId: string,
  ): Promise<ProductDocument | null> {
    return this.productModel
      .findOneAndUpdate(
        { _id: id, createdBy: new Types.ObjectId(userId) },
        product,
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();
  }

  delete(id: string, userId: string): Promise<ProductDocument | null> {
    return this.productModel
      .findOneAndDelete({ _id: id, createdBy: new Types.ObjectId(userId) })
      .exec();
  }

  private buildFilter(filters: ProductListFilters): QueryFilter<Product> {
    const filter: QueryFilter<Product> = {};
    if (filters.category) {
      filter.category = filters.category.trim().toLowerCase();
    }
    if (filters.name) {
      filter.title = {
        $regex: escapeRegExp(filters.name.trim()),
        $options: 'i',
      };
    }
    if (filters.modifiedAfter || filters.modifiedBefore) {
      filter.updatedAt = {
        ...(filters.modifiedAfter && {
          $gte: new Date(filters.modifiedAfter),
        }),
        ...(filters.modifiedBefore && {
          $lte: new Date(filters.modifiedBefore),
        }),
      };
    }
    return filter;
  }

  private findWithFilter(
    filter: QueryFilter<Product>,
    filters: ProductListFilters,
    limit: number,
    offset: number,
  ): Promise<ProductDocument[]> {
    return this.productModel
      .find(filter)
      .sort({ [filters.sortBy]: filters.order === 'asc' ? 1 : -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
