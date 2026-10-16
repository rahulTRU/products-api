import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { UserRole } from '../common/enums/auth.enum.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import type { ProductDocument } from '../products/schemas/product.schema.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import {
  InventoryRepository,
  type InventoryProductLookup,
  type InventoryWithProductLookup,
} from './inventory.repository.js';
import type { InventoryDocument } from './schemas/inventory.schema.js';

export interface InventorySummary {
  id: string;
  quantity: number;
  availabilityStatus: 'In Stock' | 'Out of Stock';
  updatedAt: Date;
}

interface InventoryProductResponse {
  id: string;
  title: string;
  category: string;
  price: number;
  thumbnail?: string;
}

export interface InventoryResponse extends InventorySummary {
  productId: string;
  sellerId: string | null;
  createdAt: Date;
  product: InventoryProductResponse;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async onModuleInit(): Promise<void> {
    const result = await this.inventoryRepository.migrateLegacyStock();
    if (result.migrated > 0) {
      this.logger.log(
        `Migrated stock from ${result.migrated} product(s) into inventory`,
      );
    }
    if (result.skipped > 0) {
      this.logger.warn(
        `Skipped ${result.skipped} product(s) with invalid legacy stock; their stock data was preserved`,
      );
    }
  }

  async findAll(
    user: AuthPrincipal,
    query: ListInventoryQueryDto,
  ): Promise<InventoryResponse[]> {
    this.assertInventoryRole(user);
    const inventory =
      user.role === UserRole.ADMIN
        ? await this.inventoryRepository.findAll(query.limit, query.skip)
        : await this.inventoryRepository.findBySellerId(
            user.id,
            query.limit,
            query.skip,
          );
    return inventory.map((item) => toJoinedInventoryResponse(item));
  }

  async findMine(
    user: AuthPrincipal,
    query: ListInventoryQueryDto,
  ): Promise<InventoryResponse[]> {
    if (user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Seller role required');
    }
    return (
      await this.inventoryRepository.findBySellerId(
        user.id,
        query.limit,
        query.skip,
      )
    ).map((item) => toJoinedInventoryResponse(item));
  }

  async findByProductId(
    productId: string,
    user: AuthPrincipal,
  ): Promise<InventoryResponse> {
    this.assertInventoryRole(user);
    const inventory = await this.inventoryRepository.findByProductId(
      productId,
      user.role === UserRole.SELLER ? user.id : undefined,
    );
    if (!inventory) {
      throw new NotFoundException('Inventory was not found');
    }
    return (await this.toResponses([inventory]))[0]!;
  }

  async create(
    dto: CreateInventoryDto,
    user: AuthPrincipal,
  ): Promise<InventoryResponse> {
    this.assertInventoryRole(user);
    const product = await this.findProductForInventory(dto.productId);
    this.assertProductOwner(product, user);

    try {
      const inventory = await this.inventoryRepository.create(
        dto.productId,
        product.createdBy ? String(product.createdBy) : null,
        dto.quantity,
      );
      return (await this.toResponses([inventory]))[0]!;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Inventory already exists for this product',
        );
      }
      throw error;
    }
  }

  async updateQuantity(
    productId: string,
    dto: UpdateInventoryDto,
    user: AuthPrincipal,
  ): Promise<InventoryResponse> {
    this.assertInventoryRole(user);
    const inventory = await this.inventoryRepository.updateQuantity(
      productId,
      dto.quantity,
      user.role === UserRole.SELLER ? user.id : undefined,
    );
    if (!inventory) {
      throw new NotFoundException('Inventory was not found');
    }
    return (await this.toResponses([inventory]))[0]!;
  }

  async getQuantitiesByProductIds(
    productIds: string[],
  ): Promise<Map<string, InventorySummary>> {
    const inventory =
      await this.inventoryRepository.findByProductIds(productIds);
    return new Map(
      inventory.map((item) => [
        item.productId.toString(),
        {
          id: item._id.toString(),
          quantity: item.quantity,
          availabilityStatus: availabilityStatusFor(item.quantity),
          updatedAt: item.updatedAt,
        },
      ]),
    );
  }

  async getAvailableQuantity(productId: string): Promise<number> {
    const inventory =
      await this.inventoryRepository.findByProductId(productId);
    return inventory?.quantity ?? 0;
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.inventoryRepository.deleteByProductId(productId);
  }

  private assertInventoryRole(user: AuthPrincipal): void {
    if (user.role !== UserRole.SELLER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seller or admin role required');
    }
  }

  private async findProductForInventory(
    productId: string,
  ): Promise<ProductDocument> {
    const product =
      await this.inventoryRepository.findProductByIdWithOwner(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }
    return product;
  }

  private assertProductOwner(
    product: ProductDocument,
    user: AuthPrincipal,
  ): void {
    if (
      user.role === UserRole.SELLER &&
      (!product.createdBy || product.createdBy.toString() !== user.id)
    ) {
      throw new ForbiddenException(
        'Sellers can only manage inventory for their own products',
      );
    }
  }

  private async toResponses(
    inventory: InventoryDocument[],
  ): Promise<InventoryResponse[]> {
    const productIds = inventory.map((item) => item.productId.toString());
    const products =
      await this.inventoryRepository.findProductsByIds(productIds);
    const productsById = new Map(
      products.map((product) => [product._id.toString(), product]),
    );
    return inventory.map((item) => {
      const product = productsById.get(item.productId.toString());
      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId.toString()} referenced by inventory was not found`,
        );
      }
      return toInventoryResponse(item, product);
    });
  }
}

function toInventoryResponse(
  inventory: InventoryDocument,
  product: InventoryProductLookup,
): InventoryResponse {
  return {
    id: inventory._id.toString(),
    productId: inventory.productId.toString(),
    sellerId: inventory.sellerId?.toString() ?? null,
    quantity: inventory.quantity,
    availabilityStatus: availabilityStatusFor(inventory.quantity),
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
    product: {
      id: product._id.toString(),
      title: product.title,
      category: product.category,
      price: product.price,
      thumbnail: product.thumbnail,
    },
  };
}

function toJoinedInventoryResponse(
  inventory: InventoryWithProductLookup,
): InventoryResponse {
  if (!inventory.product) {
    throw new NotFoundException(
      `Product ${inventory.productId.toString()} referenced by inventory was not found`,
    );
  }
  return {
    id: inventory._id.toString(),
    productId: inventory.productId.toString(),
    sellerId: inventory.sellerId?.toString() ?? null,
    quantity: inventory.quantity,
    availabilityStatus: availabilityStatusFor(inventory.quantity),
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
    product: {
      id: inventory.product._id.toString(),
      title: inventory.product.title,
      category: inventory.product.category,
      price: inventory.product.price,
      thumbnail: inventory.product.thumbnail,
    },
  };
}

function availabilityStatusFor(
  quantity: number,
): 'In Stock' | 'Out of Stock' {
  return quantity > 0 ? 'In Stock' : 'Out of Stock';
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
