import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { UserRole } from '../common/enums/auth.enum.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { BusinessesRepository } from '../businesses/businesses.repository.js';
import { AddressesService } from '../addresses/addresses.service.js';
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
  businessId: string | null;
  unitPrice: number;
  reservedQuantity: number;
  createdAt: Date;
  product: InventoryProductResponse;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly businessesRepository: BusinessesRepository,
    private readonly addressesService: AddressesService,
  ) {}

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
    if (!isSeller(user) && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seller or Admin role required');
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
    businessId: string,
    user: AuthPrincipal,
  ): Promise<InventoryResponse> {
    this.assertInventoryRole(user);
    if (
      user.role !== UserRole.ADMIN &&
      !(await this.businessesRepository.findOneForOwner(businessId, user.id))
    ) {
      throw new NotFoundException('Business was not found');
    }
    const inventory = await this.inventoryRepository.findByProductId(
      productId,
      businessId,
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
    await this.findProductForInventory(dto.productId);
    const business =
      user.role === UserRole.ADMIN
        ? await this.businessesRepository.findById(dto.businessId)
        : await this.businessesRepository.findOneForOwner(
            dto.businessId,
            user.id,
          );
    if (!business) {
      throw new NotFoundException('Business was not found');
    }

    try {
      const inventory = await this.inventoryRepository.create(
        dto.productId,
        dto.businessId,
        business.ownerId.toString(),
        dto.unitPrice,
        dto.quantity,
      );
      return (await this.toResponses([inventory]))[0]!;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'This business already has an offer for this product',
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
    if (
      user.role !== UserRole.ADMIN &&
      !(await this.businessesRepository.findOneForOwner(
        dto.businessId,
        user.id,
      ))
    ) {
      throw new NotFoundException('Business was not found');
    }
    const inventory = await this.inventoryRepository.updateQuantity(
      productId,
      dto.businessId,
      dto.quantity,
      dto.unitPrice,
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
    const summaries = new Map<string, InventorySummary>();
    for (const item of inventory) {
      const productId = item.productId.toString();
      const previous = summaries.get(productId);
      const quantity =
        (previous?.quantity ?? 0) +
        item.quantity -
        (item.reservedQuantity ?? 0);
      summaries.set(productId, {
        id: previous?.id ?? item._id.toString(),
        quantity,
        availabilityStatus: availabilityStatusFor(quantity),
        updatedAt:
          !previous || item.updatedAt > previous.updatedAt
            ? item.updatedAt
            : previous.updatedAt,
      });
    }
    return summaries;
  }

  async getAvailableQuantity(
    productId: string,
    businessId: string,
  ): Promise<number> {
    const inventory =
      await this.inventoryRepository.findOneOffer(productId, businessId);
    return inventory
      ? inventory.quantity - (inventory.reservedQuantity ?? 0)
      : 0;
  }

  async getOfferForCart(
    productId: string,
    businessId: string,
    session?: ClientSession,
  ) {
    const offer = await this.inventoryRepository.findOneOffer(
      productId,
      businessId,
      session,
    );
    if (!offer) {
      return null;
    }
    return {
      id: offer._id.toString(),
      unitPrice: offer.unitPrice ?? 0,
      availableQuantity:
        offer.quantity - (offer.reservedQuantity ?? 0),
    };
  }

  async getOffersByProductId(productId: string) {
    const offers =
      await this.inventoryRepository.findOffersByProductId(productId);
    return Promise.all(
      offers.map(async (offer) => {
        const businessId = offer.businessId?.toString();
        const business = businessId
          ? await this.businessesRepository.findById(businessId)
          : null;
        if (!business) {
          return null;
        }
        const addresses = await this.addressesService.findSummariesForUser(
          business.addressIds.map((addressId) => addressId.toString()),
          business.ownerId.toString(),
        );
        return {
          id: offer._id.toString(),
          productId: offer.productId.toString(),
          businessId,
          businessName: business.businessName,
          sellerId: business.ownerId.toString(),
          addresses: addresses.map((address) => ({
            id: address._id.toString(),
            formattedAddress: address.formattedAddress,
            city: address.components?.city ?? null,
            state: address.components?.state ?? null,
            country: address.components?.country ?? null,
          })),
          unitPrice: offer.unitPrice ?? 0,
          availableQuantity:
            offer.quantity - (offer.reservedQuantity ?? 0),
        };
      }),
    ).then((result) => result.filter((offer) => offer !== null));
  }

  reserve(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    return this.inventoryRepository.reserve(
      productId,
      businessId,
      quantity,
      session,
    );
  }

  releaseReservation(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    return this.inventoryRepository.releaseReservation(
      productId,
      businessId,
      quantity,
      session,
    );
  }

  commitReservation(
    productId: string,
    businessId: string,
    quantity: number,
    session: ClientSession,
  ): Promise<boolean> {
    return this.inventoryRepository.commitReservation(
      productId,
      businessId,
      quantity,
      session,
    );
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.inventoryRepository.deleteByProductId(productId);
  }

  async deleteOffer(
    productId: string,
    businessId: string,
    user: AuthPrincipal,
  ): Promise<void> {
    if (
      user.role !== UserRole.ADMIN &&
      !(await this.businessesRepository.findOneForOwner(
        businessId,
        user.id,
      ))
    ) {
      throw new NotFoundException('Business was not found');
    }
    const deleted = await this.inventoryRepository.deleteOffer(
      productId,
      businessId,
    );
    if (!deleted) {
      throw new NotFoundException('Business offer was not found');
    }
  }

  hasOffersForProduct(productId: string): Promise<boolean> {
    return this.inventoryRepository.hasOffersForProduct(productId);
  }

  private assertInventoryRole(user: AuthPrincipal): void {
    if (!isSeller(user) && user.role !== UserRole.ADMIN) {
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
    businessId: inventory.businessId?.toString() ?? null,
    unitPrice: inventory.unitPrice ?? product.price,
    quantity: inventory.quantity - (inventory.reservedQuantity ?? 0),
    reservedQuantity: inventory.reservedQuantity ?? 0,
    availabilityStatus: availabilityStatusFor(
      inventory.quantity - (inventory.reservedQuantity ?? 0),
    ),
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
    businessId: inventory.businessId?.toString() ?? null,
    unitPrice: inventory.unitPrice ?? inventory.product.price,
    quantity: inventory.quantity - (inventory.reservedQuantity ?? 0),
    reservedQuantity: inventory.reservedQuantity ?? 0,
    availabilityStatus: availabilityStatusFor(
      inventory.quantity - (inventory.reservedQuantity ?? 0),
    ),
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

function isSeller(user: AuthPrincipal): boolean {
  return user.sellerEnabled === true || user.role === UserRole.SELLER;
}
