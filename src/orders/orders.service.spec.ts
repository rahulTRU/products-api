import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InventoryService } from '../inventory/inventory.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { OrderStatus, SellerDeliveryStatus } from './schemas/order.schema.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { PaymentStatus } from '../payments/schemas/payment.schema.js';

describe('OrdersService checkout', () => {
  const buyerId = '6ad241c4518543c0e9ca45c7';
  const businessId = '65cb7f4a2d3b4c001f3e7a92';
  const addressId = '65cb7f4a2d3b4c001f3e7a91';
  const productId = '65cb7f4a2d3b4c001f3e7a93';
  const inventoryId = '65cb7f4a2d3b4c001f3e7a94';
  const sellerId = '65cb7f4a2d3b4c001f3e7a95';

  function setup(
    paymentStatus = PaymentStatus.SIMULATED_SUCCEEDED,
    sellerState = 'NC',
  ) {
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn(),
    };
    const address = {
      _id: new Types.ObjectId(addressId),
      userId: new Types.ObjectId(buyerId),
      formattedAddress: 'Raleigh, NC',
      components: { city: 'Raleigh', state: 'NC', country: 'US' },
      location: {
        type: 'Point' as const,
        coordinates: [-78.6382, 35.7796] as [number, number],
      },
    };
    const serviceAddress = {
      _id: new Types.ObjectId('65cb7f4a2d3b4c001f3e7a96'),
      userId: new Types.ObjectId(sellerId),
      formattedAddress: 'Charlotte, NC',
      components: { city: 'Charlotte', state: sellerState, country: 'US' },
      location: {
        type: 'Point' as const,
        coordinates: [-80.8431, 35.2271] as [number, number],
      },
    };
    const cart = {
      products: [
        {
          productId: new Types.ObjectId(productId),
          businessId: new Types.ObjectId(businessId),
          quantity: 2,
        },
      ],
    };
    const business = {
      _id: new Types.ObjectId(businessId),
      ownerId: new Types.ObjectId(sellerId),
      businessName: 'Fresh Store',
      addressIds: [serviceAddress._id],
    };
    const order = {
      _id: new Types.ObjectId('65cb7f4a2d3b4c001f3e7a97'),
      sellerDeliveries: [{ status: SellerDeliveryStatus.AWAITING_PAYMENT }],
      save: vi.fn(async () => order),
    };
    const ordersRepository = {
      findAddress: vi.fn().mockResolvedValue(address),
      findCart: vi.fn().mockResolvedValue(cart),
      findProducts: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(productId),
          title: 'Apples',
          sku: 'APL-1',
          price: 15,
          discountPercentage: 0,
        },
      ]),
      findBusinesses: vi.fn().mockResolvedValue([business]),
      findAddresses: vi.fn().mockResolvedValue([serviceAddress]),
      create: vi.fn().mockResolvedValue(order),
      clearCart: vi.fn(),
    };
    const inventoryService = {
      getOfferForCart: vi.fn().mockResolvedValue({
        id: inventoryId,
        unitPrice: 12,
        availableQuantity: 4,
      }),
      reserve: vi.fn().mockResolvedValue(true),
      commitReservation: vi.fn().mockResolvedValue(true),
      releaseReservation: vi.fn().mockResolvedValue(true),
    };
    const paymentsService = {
      createSimulatedPayment: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId('65cb7f4a2d3b4c001f3e7a98'),
        status: paymentStatus,
      }),
    };
    const connection = {
      startSession: vi.fn().mockResolvedValue(session),
    };
    const service = new OrdersService(
      ordersRepository as unknown as OrdersRepository,
      inventoryService as unknown as InventoryService,
      paymentsService as unknown as PaymentsService,
      connection as never,
    );
    const futureWindow = new Date(
      Math.ceil((Date.now() + 4 * 60 * 60 * 1000) / 3_600_000) * 3_600_000,
    ).toISOString();
    return {
      service,
      order,
      session,
      ordersRepository,
      inventoryService,
      paymentsService,
      dto: {
        addressId,
        deliveryWindowStart: futureWindow,
        timeZone: 'UTC',
      },
    };
  }

  it('creates seller-specific delivery and commits reserved stock on payment success', async () => {
    const context = setup();

    await expect(
      context.service.create(context.dto, {
        id: buyerId,
        role: 'buyer',
      }),
    ).resolves.toBe(context.order);
    expect(context.ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrderStatus.PENDING_PAYMENT,
        subtotal: 24,
        currency: 'INR',
        sellerDeliveries: [
          expect.objectContaining({
            sellerId: expect.any(Types.ObjectId),
            businessName: 'Fresh Store',
            grossAmount: 24,
          }),
        ],
      }),
      context.session,
    );
    expect(context.inventoryService.reserve).toHaveBeenCalledWith(
      productId,
      businessId,
      2,
      context.session,
    );
    expect(context.paymentsService.createSimulatedPayment).toHaveBeenCalledWith(
      '65cb7f4a2d3b4c001f3e7a97',
      buyerId,
      24,
      context.session,
    );
    expect(context.inventoryService.commitReservation).toHaveBeenCalledWith(
      productId,
      businessId,
      2,
      context.session,
    );
    expect(context.inventoryService.releaseReservation).not.toHaveBeenCalled();
    expect(context.ordersRepository.clearCart).toHaveBeenCalledWith(
      buyerId,
      context.session,
    );
    expect(context.order.status).toBe(OrderStatus.CONFIRMED);
    expect(context.order.sellerDeliveries[0]?.status).toBe(
      SellerDeliveryStatus.PREPARING,
    );
  });

  it('releases reserved stock and retains a failed payment order', async () => {
    const context = setup(PaymentStatus.SIMULATED_FAILED);

    await context.service.create(context.dto, {
      id: buyerId,
      role: 'buyer',
    });

    expect(context.inventoryService.releaseReservation).toHaveBeenCalledWith(
      productId,
      businessId,
      2,
      context.session,
    );
    expect(context.inventoryService.commitReservation).not.toHaveBeenCalled();
    expect(context.ordersRepository.clearCart).not.toHaveBeenCalled();
    expect(context.order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(context.order.sellerDeliveries[0]?.status).toBe(
      SellerDeliveryStatus.CANCELLED,
    );
  });

  it('rejects checkout when no seller service address matches buyer city or state', async () => {
    const context = setup(PaymentStatus.SIMULATED_SUCCEEDED, 'VA');

    await expect(
      context.service.create(context.dto, { id: buyerId, role: 'buyer' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(context.inventoryService.reserve).not.toHaveBeenCalled();
    expect(context.paymentsService.createSimulatedPayment).not.toHaveBeenCalled();
  });

  it('rejects checkout if current available stock is insufficient', async () => {
    const context = setup();
    context.inventoryService.getOfferForCart.mockResolvedValue({
      id: inventoryId,
      unitPrice: 12,
      availableQuantity: 1,
    });

    await expect(
      context.service.create(context.dto, { id: buyerId, role: 'buyer' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(context.inventoryService.reserve).not.toHaveBeenCalled();
    expect(context.paymentsService.createSimulatedPayment).not.toHaveBeenCalled();
  });

  it('offers one-hour windows starting at least two hours in the future', async () => {
    const context = setup();
    const before = Date.now() + 2 * 60 * 60 * 1000;

    const windows = await context.service.getAvailableDeliveryWindows('UTC');

    expect(windows).toHaveLength(12);
    expect(new Date(windows[0]!.startsAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(
      new Date(windows[0]!.endsAt).getTime() -
        new Date(windows[0]!.startsAt).getTime(),
    ).toBe(60 * 60 * 1000);
    expect(windows[0]!.timeZone).toBe('UTC');
  });

});
