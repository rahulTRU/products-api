import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service.js';
import type { InventorySummary } from '../inventory/inventory.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  parseProductSelection,
  projectProductResponse,
  type ProductSelectableField,
} from './product-selection.js';
import type { ProductDocument } from './schemas/product.schema.js';
import { ProductsRepository } from './products.repository.js';

type ProductResponse = ReturnType<ProductDocument['toObject']> & {
  inventory: InventorySummary | null;
  availabilityStatus: InventorySummary['availabilityStatus'];
};
type SelectedProductResponse = ProductResponse | Record<string, unknown>;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(query: ListProductsQueryDto): Promise<SelectedProductResponse[]> {
    this.validateModifiedDateRange(query);
    const { limit, skip, offset, select, ...filters } = query;
    const selectedFields = parseProductSelection(select);
    return this.withInventory(
      await this.productsRepository.findAll(
        filters,
        limit,
        skip ?? offset ?? 0,
        selectedFields,
      ),
      selectedFields,
    );
  }

  async findMine(
    userId: string,
    query: ListProductsQueryDto,
  ): Promise<SelectedProductResponse[]> {
    this.validateModifiedDateRange(query);
    const { limit, skip, offset, select, ...filters } = query;
    const selectedFields = parseProductSelection(select);
    return this.withInventory(
      await this.productsRepository.findMine(
        userId,
        filters,
        limit,
        skip ?? offset ?? 0,
        selectedFields,
      ),
      selectedFields,
    );
  }

  async findCategories(): Promise<string[]> {
    return this.productsRepository.findCategories();
  }

  async findByCategory(
    category: string,
    query: ListProductsQueryDto,
  ): Promise<SelectedProductResponse[]> {
    const normalizedCategory = category.trim().toLowerCase();
    if (!(await this.productsRepository.existsInCategory(normalizedCategory))) {
      throw new NotFoundException(
        `Product category ${category} was not found`,
      );
    }
    this.validateModifiedDateRange(query);
    const selectedFields = parseProductSelection(query.select);
    return this.withInventory(
      await this.productsRepository.findAll(
        {
          category: normalizedCategory,
          name: query.name,
          sortBy: query.sortBy,
          order: query.order,
          modifiedAfter: query.modifiedAfter,
          modifiedBefore: query.modifiedBefore,
        },
        query.limit,
        query.skip ?? query.offset ?? 0,
        selectedFields,
      ),
      selectedFields,
    );
  }

  async findOne(
    id: string,
    select?: string,
  ): Promise<SelectedProductResponse> {
    const selectedFields = parseProductSelection(select);
    const product = await this.productsRepository.findById(id, selectedFields);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    return (await this.withInventory([product], selectedFields))[0]!;
  }

  async create(
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponse> {
    const product = await this.productsRepository.create(
      createProductDto,
      userId,
    );
    this.logger.log(`Created product ${product.id}`);
    return (await this.withInventory([product]))[0]!;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
  ): Promise<ProductResponse> {
    const product = await this.productsRepository.update(
      id,
      updateProductDto,
      userId,
    );
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    this.logger.log(`Updated product ${product.id}`);
    return (await this.withInventory([product]))[0]!;
  }

  async remove(id: string, userId: string): Promise<ProductDocument> {
    const product = await this.productsRepository.delete(id, userId);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    await this.inventoryService.deleteByProductId(id);
    this.logger.log(`Deleted product ${product.id}`);
    return product;
  }

  private withInventory(products: ProductDocument[]): Promise<ProductResponse[]>;
  private withInventory(
    products: ProductDocument[],
    selectedFields: ProductSelectableField[],
  ): Promise<Record<string, unknown>[]>;
  private withInventory(
    products: ProductDocument[],
    selectedFields: ProductSelectableField[] | undefined,
  ): Promise<SelectedProductResponse[]>;
  private async withInventory(
    products: ProductDocument[],
    selectedFields?: ProductSelectableField[],
  ): Promise<SelectedProductResponse[]> {
    const needsInventory =
      !selectedFields ||
      selectedFields.includes('inventory') ||
      selectedFields.includes('availabilityStatus');
    const inventoryByProductId = needsInventory
      ? await this.inventoryService.getQuantitiesByProductIds(
          products.map((product) => product._id.toString()),
        )
      : new Map<string, InventorySummary>();
    return products.map((product) => {
      const inventory =
        inventoryByProductId.get(product._id.toString()) ?? null;
      const response = Object.assign(product.toObject(), {
        inventory,
        availabilityStatus:
          inventory?.availabilityStatus ?? 'Out of Stock',
      });
      return selectedFields
        ? projectProductResponse(response, selectedFields)
        : response;
    });
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
