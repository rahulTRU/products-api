import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose from 'mongoose';
import { UserRole } from '../common/enums/auth.enum.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { ProductDocument } from '../products/schemas/product.schema.js';
import { ListCartsQueryDto } from './dto/list-carts-query.dto.js';
import { UpdateCartProductDto } from './dto/update-cart-product.dto.js';
import { CartsRepository } from './carts.repository.js';
import type { CartDocument } from './schemas/cart.schema.js';

interface CartProductResponse {
  id: string;
  businessId: string | null;
  businessName: string | null;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountPercentage: number;
  discountedTotal: number;
  thumbnail: string;
  unitPrice: number;
}

export interface CartResponse {
  id: string;
  products: CartProductResponse[];
  total: number;
  discountedTotal: number;
  userId: string;
  totalProducts: number;
  totalQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CartsService {
  constructor(
    private readonly cartsRepository: CartsRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(
    user: AuthPrincipal,
    query: ListCartsQueryDto,
  ): Promise<CartResponse[]> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin role required to list all carts');
    }
    const carts = await this.cartsRepository.findAll(query.limit, query.skip);
    const products = await this.getProductMap(carts);
    const offers = await this.getOfferMap(carts);
    const businesses = await this.getBusinessMap(carts);
    return carts.map((cart) =>
      toCartResponse(cart, products, offers, businesses),
    );
  }

  async findMine(user: AuthPrincipal): Promise<CartResponse> {
    this.assertCartRole(user);
    const cart = await this.cartsRepository.findByUserId(user.id);
    if (!cart) {
      throw new NotFoundException('Cart was not found');
    }
    return toCartResponse(
      cart,
      await this.getProductMap([cart]),
      await this.getOfferMap([cart]),
      await this.getBusinessMap([cart]),
    );
  }

  async putProductInMine(
    productId: string,
    dto: UpdateCartProductDto,
    user: AuthPrincipal,
  ): Promise<CartResponse> {
    await this.findProduct(productId);
    await this.ensureStock(productId, dto.businessId, dto.quantity);
    const cart = await this.cartsRepository.findOrCreateByUserId(user.id);

    const updatedCart = await this.saveWithConflict(() =>
      this.cartsRepository.putProductQuantity(
        cart,
        productId.toLowerCase(),
        dto.businessId.toLowerCase(),
        dto.quantity,
      ),
    );
    return toCartResponse(
      updatedCart,
      await this.getProductMap([updatedCart]),
      await this.getOfferMap([updatedCart]),
      await this.getBusinessMap([updatedCart]),
    );
  }

  async removeProductFromMine(
    productId: string,
    businessId: string,
    user: AuthPrincipal,
  ): Promise<CartResponse> {
    this.assertCartRole(user);
    const cart = await this.cartsRepository.findByUserId(user.id);
    if (!cart) {
      throw new NotFoundException('Cart was not found');
    }
    const updatedCart = await this.saveWithConflict(() =>
      this.cartsRepository.removeProduct(
        cart,
        productId.toLowerCase(),
        businessId.toLowerCase(),
      ),
    );
    if (!updatedCart) {
      throw new NotFoundException('Product was not found in this cart');
    }
    return toCartResponse(
      updatedCart,
      await this.getProductMap([updatedCart]),
      await this.getOfferMap([updatedCart]),
      await this.getBusinessMap([updatedCart]),
    );
  }

  private assertCartRole(user: AuthPrincipal): void {
    if (
      user.role !== UserRole.BUYER &&
      user.role !== UserRole.SELLER &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only buyers and admins can access carts');
    }
  }

  private async findProduct(id: string): Promise<ProductDocument> {
    const product = await this.cartsRepository.findProductById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} was not found`);
    }
    return product;
  }

  private async ensureStock(
    productId: string,
    businessId: string,
    quantity: number,
  ): Promise<void> {
    const offer = await this.inventoryService.getOfferForCart(
      productId,
      businessId,
    );
    if (!offer) {
      throw new NotFoundException('Business offer was not found');
    }
    if (quantity > offer.availableQuantity) {
      throw new BadRequestException(
        `Requested quantity exceeds available inventory (${offer.availableQuantity})`,
      );
    }
  }

  private async saveWithConflict<T>(save: () => Promise<T>): Promise<T> {
    try {
      return await save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'Cart changed during this request; reload it and try again',
        );
      }
      throw error;
    }
  }

  private async getProductMap(
    carts: CartDocument[],
  ): Promise<Map<string, ProductDocument>> {
    const productIds = [
      ...new Set(
        carts.flatMap((cart) =>
          cart.products.map((entry) => entry.productId.toString()),
        ),
      ),
    ];
    const products = await this.cartsRepository.findProductsByIds(productIds);
    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );
    if (productMap.size !== productIds.length) {
      throw new NotFoundException(
        'One or more products in the cart no longer exist',
      );
    }
    return productMap;
  }

  private async getOfferMap(
    carts: CartDocument[],
  ): Promise<Map<string, { unitPrice: number; availableQuantity: number }>> {
    const entries = carts.flatMap((cart) =>
      cart.products.flatMap((entry) =>
        entry.businessId
          ? [
              {
                productId: entry.productId.toString(),
                businessId: entry.businessId.toString(),
              },
            ]
          : [],
      ),
    );
    const offers = await Promise.all(
      entries.map(async (entry) => ({
        key: offerKey(entry.productId, entry.businessId),
        offer: await this.inventoryService.getOfferForCart(
          entry.productId,
          entry.businessId,
        ),
      })),
    );
    const missingOffer = offers.find(({ offer }) => !offer);
    if (missingOffer) {
      throw new ConflictException(
        'A business offer in this cart is no longer available; remove it and select another offer',
      );
    }
    return new Map(
      offers.flatMap(({ key, offer }) =>
        offer ? [[key, offer] as const] : [],
      ),
    );
  }

  private async getBusinessMap(carts: CartDocument[]) {
    const businessIds = [
      ...new Set(
        carts.flatMap((cart) =>
          cart.products.flatMap((entry) =>
            entry.businessId ? [entry.businessId.toString()] : [],
          ),
        ),
      ),
    ];
    const businesses =
      await this.cartsRepository.findBusinessesByIds(businessIds);
    return new Map(
      businesses.map((business) => [
        business._id.toString(),
        business.businessName,
      ]),
    );
  }
}

function toCartResponse(
  cart: CartDocument,
  products: Map<string, ProductDocument>,
  offers: Map<string, { unitPrice: number; availableQuantity: number }>,
  businesses: Map<string, string>,
): CartResponse {
  const entries = cart.products.map((entry) => {
    const productId = entry.productId.toString();
    const product = products.get(productId);
    if (!product) {
      throw new NotFoundException(
        `Product ${productId} referenced by the cart was not found`,
      );
    }
    const businessId = entry.businessId?.toString() ?? null;
    const offer = businessId
      ? offers.get(offerKey(productId, businessId))
      : undefined;
    const unitPrice = offer?.unitPrice ?? product.price;
    const total = roundMoney(unitPrice * entry.quantity);
    const discountPercentage = product.discountPercentage ?? 0;
    return {
      id: productId,
      businessId,
      businessName: businessId ? businesses.get(businessId) ?? null : null,
      title: product.title,
      price: unitPrice,
      unitPrice,
      quantity: entry.quantity,
      total,
      discountPercentage,
      discountedTotal: roundMoney(
        total * (1 - discountPercentage / 100),
      ),
      thumbnail: product.thumbnail ?? '',
    };
  });
  const total = roundMoney(
    entries.reduce((sum, entry) => sum + entry.total, 0),
  );

  return {
    id: String(cart._id),
    products: entries,
    total,
    discountedTotal: roundMoney(
      entries.reduce((sum, entry) => sum + entry.discountedTotal, 0),
    ),
    userId: cart.userId.toString(),
    totalProducts: entries.length,
    totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

function offerKey(productId: string, businessId: string): string {
  return `${productId}:${businessId}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
