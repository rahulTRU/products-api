import mongoose from 'mongoose';
import { UserRole } from '../common/enums/auth.enum.js';
import { CartsRepository } from './carts.repository.js';
import { CartsService } from './carts.service.js';

describe('CartsService', () => {
  it('allows a seller to update a product in their cart', async () => {
    const productId = new mongoose.Types.ObjectId();
    const product = {
      _id: productId,
      title: 'Mascara',
      price: 9.99,
      discountPercentage: 0,
      thumbnail: '',
    };
    const cart = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      products: [
        {
          productId,
          businessId: new mongoose.Types.ObjectId(),
          quantity: 2,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repository = {
      findProductById: vi.fn().mockResolvedValue(product),
      findOrCreateByUserId: vi.fn().mockResolvedValue(cart),
      putProductQuantity: vi.fn().mockResolvedValue(cart),
      findProductsByIds: vi.fn().mockResolvedValue([product]),
      findBusinessesByIds: vi.fn().mockResolvedValue([
        {
          _id: cart.products[0]!.businessId,
          businessName: 'Test Seller',
        },
      ]),
    };
    const inventoryService = {
      getOfferForCart: vi.fn().mockResolvedValue({
        id: String(new mongoose.Types.ObjectId()),
        unitPrice: 9.99,
        availableQuantity: 5,
      }),
    };
    const service = new CartsService(
      repository as unknown as CartsRepository,
      inventoryService as unknown as ConstructorParameters<
        typeof CartsService
      >[1],
    );

    await expect(
      service.putProductInMine(
        String(productId),
        {
          businessId: String(cart.products[0]!.businessId),
          quantity: 2,
        },
        { id: String(cart.userId), role: UserRole.SELLER },
      ),
    ).resolves.toMatchObject({
      userId: String(cart.userId),
      products: [
        {
          id: String(productId),
          businessId: String(cart.products[0]!.businessId),
          quantity: 2,
        },
      ],
    });
    expect(repository.findOrCreateByUserId).toHaveBeenCalledWith(
      String(cart.userId),
    );
  });
});
