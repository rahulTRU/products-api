import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductDocument } from './schemas/product.schema.js';
import { ProductsRepository } from './products.repository.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
  ) {}

  findAll(): Promise<ProductDocument[]> {
    return this.productsRepository.findAll();
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<ProductDocument> {
    const product = await this.productsRepository.create(createProductDto);
    this.logger.log(`Created product ${product.id}`);
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductDocument> {
    const product = await this.productsRepository.update(id, updateProductDto);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    this.logger.log(`Updated product ${product.id}`);
    return product;
  }

  async remove(id: string): Promise<ProductDocument> {
    const product = await this.productsRepository.delete(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    this.logger.log(`Deleted product ${product.id}`);
    return product;
  }
}
