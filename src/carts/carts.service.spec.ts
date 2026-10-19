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
      products: [{ productId, quantity: 2 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repository = {
      findProductById: vi.fn().mockResolvedValue(product),
      findOrCreateByUserId: vi.fn().mockResolvedValue(cart),
      putProductQuantity: vi.fn().mockResolvedValue(cart),
      findProductsByIds: vi.fn().mockResolvedValue([product]),
    };
    const inventoryService = {
      getAvailableQuantity: vi.fn().mockResolvedValue(5),
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
        { quantity: 2 },
        { id: String(cart.userId), role: UserRole.SELLER },
      ),
    ).resolves.toMatchObject({
      userId: String(cart.userId),
      products: [{ id: String(productId), quantity: 2 }],
    });
    expect(repository.findOrCreateByUserId).toHaveBeenCalledWith(
      String(cart.userId),
    );
  });
});
