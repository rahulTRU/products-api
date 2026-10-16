import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductDocument } from './schemas/product.schema.js';
import { ProductsRepository } from './products.repository.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
  ) {}

  findAll(query: ListProductsQueryDto): Promise<ProductDocument[]> {
    this.validateModifiedDateRange(query);
    const { limit, offset, ...filters } = query;
    return this.productsRepository.findAll(filters, limit, offset);
  }

  findMine(
    userId: string,
    query: ListProductsQueryDto,
  ): Promise<ProductDocument[]> {
    this.validateModifiedDateRange(query);
    const { limit, offset, ...filters } = query;
    return this.productsRepository.findMine(userId, filters, limit, offset);
  }

  async findCategories(): Promise<string[]> {
    return this.productsRepository.findCategories();
  }

  async findByCategory(
    category: string,
    query: ListProductsQueryDto,
  ): Promise<ProductDocument[]> {
    const normalizedCategory = category.trim().toLowerCase();
    if (!(await this.productsRepository.existsInCategory(normalizedCategory))) {
      throw new NotFoundException(
        `Product category ${category} was not found`,
      );
    }
    this.validateModifiedDateRange(query);
    return this.productsRepository.findAll(
      {
        category: normalizedCategory,
        name: query.name,
        sortBy: query.sortBy,
        order: query.order,
        modifiedAfter: query.modifiedAfter,
        modifiedBefore: query.modifiedBefore,
      },
      query.limit,
      query.offset,
    );
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    return product;
  }

  async create(
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductDocument> {
    const product = await this.productsRepository.create(
      createProductDto,
      userId,
    );
    this.logger.log(`Created product ${product.id}`);
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
  ): Promise<ProductDocument> {
    const product = await this.productsRepository.update(
      id,
      updateProductDto,
      userId,
    );
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    this.logger.log(`Updated product ${product.id}`);
    return product;
  }

  async remove(id: string, userId: string): Promise<ProductDocument> {
    const product = await this.productsRepository.delete(id, userId);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    this.logger.log(`Deleted product ${product.id}`);
    return product;
  }

  private validateModifiedDateRange(query: ListProductsQueryDto): void {
    if (
      query.modifiedAfter &&
      query.modifiedBefore &&
      new Date(query.modifiedAfter) > new Date(query.modifiedBefore)
    ) {
      throw new BadRequestException(
        'modifiedAfter must be earlier than or equal to modifiedBefore',
      );
    }
  }
}
