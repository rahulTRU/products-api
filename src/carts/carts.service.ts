import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose from 'mongoose';
import { UserRole } from '../common/enums/auth.enum.js';
import type { AuthUserResponse } from '../auth/auth.types.js';
import type { ProductDocument } from '../products/schemas/product.schema.js';
import { ListCartsQueryDto } from './dto/list-carts-query.dto.js';
import { UpdateCartProductDto } from './dto/update-cart-product.dto.js';
import { CartsRepository } from './carts.repository.js';
import type { CartDocument } from './schemas/cart.schema.js';

interface CartProductResponse {
  id: string;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountPercentage: number;
  discountedTotal: number;
  thumbnail: string;
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
  constructor(private readonly cartsRepository: CartsRepository) {}

  async findAll(
    user: AuthUserResponse,
    query: ListCartsQueryDto,
  ): Promise<CartResponse[]> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin role required to list all carts');
    }
    const carts = await this.cartsRepository.findAll(query.limit, query.skip);
    const products = await this.getProductMap(carts);
    return carts.map((cart) => toCartResponse(cart, products));
  }

  async findMine(user: AuthUserResponse): Promise<CartResponse> {
    this.assertCartRole(user);
    const cart = await this.cartsRepository.findByUserId(user.id);
    if (!cart) {
      throw new NotFoundException('Cart was not found');
    }
    return toCartResponse(cart, await this.getProductMap([cart]));
  }

  async putProductInMine(
    productId: string,
    dto: UpdateCartProductDto,
    user: AuthUserResponse,
  ): Promise<CartResponse> {
    this.assertCartRole(user);
    const cart = await this.cartsRepository.findOrCreateByUserId(user.id);
    const product = await this.findProduct(productId);
    this.ensureStock(product, dto.quantity);

    const updatedCart = await this.saveWithConflict(() =>
      this.cartsRepository.putProductQuantity(
        cart,
        productId.toLowerCase(),
        dto.quantity,
      ),
    );
    return toCartResponse(updatedCart, await this.getProductMap([updatedCart]));
  }

  async removeProductFromMine(
    productId: string,
    user: AuthUserResponse,
  ): Promise<CartResponse> {
    this.assertCartRole(user);
    const cart = await this.cartsRepository.findByUserId(user.id);
    if (!cart) {
      throw new NotFoundException('Cart was not found');
    }
    const updatedCart = await this.saveWithConflict(() =>
      this.cartsRepository.removeProduct(cart, productId.toLowerCase()),
    );
    if (!updatedCart) {
      throw new NotFoundException('Product was not found in this cart');
    }
    return toCartResponse(updatedCart, await this.getProductMap([updatedCart]));
  }

  private assertCartRole(user: AuthUserResponse): void {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
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

  private ensureStock(product: ProductDocument, quantity: number): void {
    if (quantity > product.stock) {
      throw new BadRequestException(
        `Requested quantity exceeds available stock for ${product.title}`,
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
}

function toCartResponse(
  cart: CartDocument,
  products: Map<string, ProductDocument>,
): CartResponse {
  const entries = cart.products.map((entry) => {
    const productId = entry.productId.toString();
    const product = products.get(productId);
    if (!product) {
      throw new NotFoundException(
        `Product ${productId} referenced by the cart was not found`,
      );
    }
    const total = roundMoney(product.price * entry.quantity);
    const discountPercentage = product.discountPercentage ?? 0;
    return {
      id: productId,
      title: product.title,
      price: product.price,
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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
