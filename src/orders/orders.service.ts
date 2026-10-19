import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersRepository } from './orders.repository.js';
import {
  OrderStatus,
  SellerDeliveryStatus,
  type OrderDocument,
} from './schemas/order.schema.js';
import { PaymentStatus } from '../payments/schemas/payment.schema.js';

const DELIVERY_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
const DELIVERY_WINDOW_MS = 60 * 60 * 1000;
const DELIVERY_WINDOW_COUNT = 12;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(dto: CreateOrderDto, user: AuthPrincipal) {
    const session = await this.connection.startSession();
    let result: OrderDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const address = await this.ordersRepository.findAddress(
          dto.addressId,
          user.id,
          session,
        );
        if (!address) {
          throw new NotFoundException('Address was not found for this user');
        }
        const deliveryWindow = validateDeliveryWindow(
          dto.deliveryWindowStart,
          dto.timeZone,
        );
        const cart = await this.ordersRepository.findCart(user.id, session);
        if (!cart || cart.products.length === 0) {
          throw new BadRequestException('Cart is empty');
        }

        const productIds = [
          ...new Set(cart.products.map((item) => item.productId.toString())),
        ];
        const businessIds = [
          ...new Set(
            cart.products.flatMap((item) =>
              item.businessId ? [item.businessId.toString()] : [],
            ),
          ),
        ];
        if (cart.products.some((item) => !item.businessId)) {
          throw new ConflictException(
            'Cart contains an item without a business offer; remove it and add the offer again',
          );
        }
        const [products, businesses] = await Promise.all([
          this.ordersRepository.findProducts(productIds, session),
          this.ordersRepository.findBusinesses(businessIds, session),
        ]);
        const productsById = new Map(
          products.map((product) => [product._id.toString(), product]),
        );
        const businessesById = new Map(
          businesses.map((business) => [business._id.toString(), business]),
        );
        if (productsById.size !== productIds.length) {
          throw new NotFoundException(
            'One or more products in the cart no longer exist',
          );
        }
        if (businessesById.size !== businessIds.length) {
          throw new ConflictException(
            'One or more business offers are no longer available',
          );
        }

        const addressIds = [
          ...new Map(
            businesses.flatMap((business) =>
              business.addressIds.map((id) => [id.toString(), id] as const),
            ),
          ).values(),
        ];
        const businessAddresses =
          await this.ordersRepository.findAddresses(addressIds, session);
        const addressesById = new Map(
          businessAddresses.map((entry) => [entry._id.toString(), entry]),
        );
        if (!address.components) {
          throw new ConflictException(
            'Delivery address needs a city or state to validate seller service areas',
          );
        }
        const deliveryComponents = address.components;
        for (const business of businesses) {
          const servesDeliveryArea = business.addressIds.some((addressId) => {
            const serviceAddress = addressesById.get(addressId.toString());
            return (
              serviceAddress?.userId.toString() ===
                business.ownerId.toString() &&
              isWithinServiceArea(
                deliveryComponents,
                serviceAddress.components,
              )
            );
          });
          if (!servesDeliveryArea) {
            throw new ConflictException(
              `${business.businessName} does not deliver to the selected city or state`,
            );
          }
        }

        const groups = new Map<
          string,
          {
            businessId: Types.ObjectId;
            sellerId: Types.ObjectId;
            businessName: string;
            businessAddresses: {
              formattedAddress: string;
              location?: { type: 'Point'; coordinates: [number, number] };
            }[];
            items: {
              productId: Types.ObjectId;
              inventoryId: Types.ObjectId;
              title: string;
              sku: string;
              quantity: number;
              unitPrice: number;
              discountPercentage: number;
              lineTotal: number;
            }[];
            grossAmount: number;
          }
        >();
        const reservations: {
          productId: string;
          businessId: string;
          quantity: number;
        }[] = [];

        for (const cartItem of cart.products) {
          if (!cartItem.businessId) {
            throw new ConflictException(
              'Cart contains an item without a business offer; remove it and add the offer again',
            );
          }
          const productId = cartItem.productId.toString();
          const businessId = cartItem.businessId.toString();
          const product = productsById.get(productId);
          const business = businessesById.get(businessId);
          if (!product || !business) {
            throw new ConflictException(
              'A product or business in the cart is no longer available',
            );
          }
          const offer = await this.inventoryService.getOfferForCart(
            productId,
            businessId,
            session,
          );
          if (!offer) {
            throw new ConflictException('A business offer is no longer available');
          }
          if (offer.availableQuantity < cartItem.quantity) {
            throw new ConflictException(
              `Insufficient stock for ${product.title}; available quantity is ${offer.availableQuantity}`,
            );
          }
          const reserved = await this.inventoryService.reserve(
            productId,
            businessId,
            cartItem.quantity,
            session,
          );
          if (!reserved) {
            throw new ConflictException(
              `Stock changed for ${product.title}; review your cart and retry`,
            );
          }
          reservations.push({ productId, businessId, quantity: cartItem.quantity });

          const discount = product.discountPercentage ?? 0;
          const unitPrice = offer.unitPrice ?? product.price;
          const lineTotal = roundMoney(
            roundMoney(unitPrice * cartItem.quantity) *
              (1 - discount / 100),
          );
          const group =
            groups.get(businessId) ??
            {
              businessId: business._id,
              sellerId: business.ownerId,
              businessName: business.businessName,
              businessAddresses: business.addressIds.flatMap((addressId) => {
                const businessAddress = addressesById.get(
                  addressId.toString(),
                );
                if (
                  !businessAddress ||
                  businessAddress.userId.toString() !==
                    business.ownerId.toString()
                ) {
                  return [];
                }
                return [
                  {
                    formattedAddress: businessAddress.formattedAddress,
                    ...(businessAddress.location && {
                      location: businessAddress.location,
                    }),
                  },
                ];
              }),
              items: [],
              grossAmount: 0,
            };
          group.items.push({
            productId: product._id,
            inventoryId: new Types.ObjectId(offer.id),
            title: product.title,
            sku: product.sku ?? '',
            quantity: cartItem.quantity,
            unitPrice,
            discountPercentage: discount,
            lineTotal,
          });
          group.grossAmount = roundMoney(group.grossAmount + lineTotal);
          groups.set(businessId, group);
        }

        const subtotal = roundMoney(
          [...groups.values()].reduce(
            (total, group) => total + group.grossAmount,
            0,
          ),
        );
        const order = await this.ordersRepository.create(
          {
            buyerId: new Types.ObjectId(user.id),
            status: OrderStatus.PENDING_PAYMENT,
            deliveryAddress: {
              addressId: address._id,
              formattedAddress: address.formattedAddress,
              ...(address.location && { location: address.location }),
            },
            deliveryWindow,
            sellerDeliveries: [...groups.values()].map((group) => ({
              ...group,
              status: SellerDeliveryStatus.AWAITING_PAYMENT,
              currency: 'INR',
            })),
            subtotal,
            currency: 'INR',
            paymentId: null,
            paymentStatus: null,
          },
          session,
        );
        const payment = await this.paymentsService.createSimulatedPayment(
          order._id.toString(),
          user.id,
          subtotal,
          session,
        );
        order.paymentId = payment._id;
        order.paymentStatus = payment.status;
        if (payment.status === PaymentStatus.SIMULATED_SUCCEEDED) {
          for (const reservation of reservations) {
            const committed = await this.inventoryService.commitReservation(
              reservation.productId,
              reservation.businessId,
              reservation.quantity,
              session,
            );
            if (!committed) {
              throw new ConflictException(
                'Reserved stock could not be committed; order transaction was cancelled',
              );
            }
          }
          order.status = OrderStatus.CONFIRMED;
          order.sellerDeliveries.forEach((delivery) => {
            delivery.status = SellerDeliveryStatus.PREPARING;
          });
          await this.ordersRepository.clearCart(user.id, session);
        } else {
          for (const reservation of reservations) {
            const released = await this.inventoryService.releaseReservation(
              reservation.productId,
              reservation.businessId,
              reservation.quantity,
              session,
            );
            if (!released) {
              throw new ConflictException(
                'Reserved stock could not be released; order transaction was cancelled',
              );
            }
          }
          order.status = OrderStatus.PAYMENT_FAILED;
          order.sellerDeliveries.forEach((delivery) => {
            delivery.status = SellerDeliveryStatus.CANCELLED;
          });
        }
        result = await order.save({ session });
      });
    } finally {
      await session.endSession();
    }
    if (!result) {
      throw new Error('Order transaction completed without an order');
    }
    return result;
  }

  async findMine(user: AuthPrincipal) {
    return this.ordersRepository.findByBuyerId(user.id);
  }

  async findOne(orderId: string, user: AuthPrincipal) {
    const order = await this.ordersRepository.findOneForBuyer(orderId, user.id);
    if (!order) {
      throw new NotFoundException('Order was not found');
    }
    return order;
  }

  async getAvailableDeliveryWindows(timeZone: string) {
    assertTimeZone(timeZone);
    const now = new Date();
    const earliest = new Date(now.getTime() + DELIVERY_LEAD_TIME_MS);
    const firstStart = nextLocalHourBoundary(earliest, timeZone);
    return Array.from({ length: DELIVERY_WINDOW_COUNT }, (_, index) => {
      const startsAt = new Date(
        firstStart.getTime() + index * DELIVERY_WINDOW_MS,
      );
      return {
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + DELIVERY_WINDOW_MS).toISOString(),
        timeZone,
      };
    });
  }

}

function validateDeliveryWindow(startText: string, timeZone: string) {
  assertTimeZone(timeZone);
  const startsAt = new Date(startText);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    startsAt.getTime() < Date.now() + DELIVERY_LEAD_TIME_MS ||
    !isLocalHourBoundary(startsAt, timeZone)
  ) {
    throw new BadRequestException(
      'Delivery window must start at a full local hour at least two hours from now',
    );
  }
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + DELIVERY_WINDOW_MS),
    timeZone,
  };
}

function assertTimeZone(timeZone: string): void {
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) {
    throw new BadRequestException('timeZone is required');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new BadRequestException('timeZone must be a valid IANA timezone');
  }
}

function isWithinServiceArea(
  deliveryArea: {
    city?: string;
    state?: string;
    country?: string;
  },
  businessArea?: {
    city?: string;
    state?: string;
    country?: string;
  },
): boolean {
  if (
    !businessArea ||
    !deliveryArea.country ||
    !businessArea.country ||
    normalizeArea(deliveryArea.country) !== normalizeArea(businessArea.country)
  ) {
    return false;
  }
  const sameCity =
    !!deliveryArea.city &&
    !!businessArea.city &&
    normalizeArea(deliveryArea.city) === normalizeArea(businessArea.city) &&
    (!deliveryArea.state ||
      !businessArea.state ||
      normalizeArea(deliveryArea.state) === normalizeArea(businessArea.state));
  const sameState =
    !!deliveryArea.state &&
    !!businessArea.state &&
    normalizeArea(deliveryArea.state) === normalizeArea(businessArea.state);
  return sameCity || sameState;
}

function normalizeArea(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

function timezoneOffset(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function nextLocalHourBoundary(date: Date, timeZone: string): Date {
  const parts = localParts(date, timeZone);
  let targetWallTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour + (parts.minute > 0 || parts.second > 0 ? 1 : 0),
  );
  let candidate = new Date(targetWallTime - timezoneOffset(date, timeZone));
  candidate = new Date(
    targetWallTime - timezoneOffset(candidate, timeZone),
  );
  if (candidate.getTime() < date.getTime()) {
    targetWallTime += DELIVERY_WINDOW_MS;
    candidate = new Date(targetWallTime - timezoneOffset(candidate, timeZone));
  }
  return candidate;
}

function isLocalHourBoundary(date: Date, timeZone: string): boolean {
  const parts = localParts(date, timeZone);
  return parts.minute === 0 && parts.second === 0 && date.getUTCMilliseconds() === 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
