import { BadRequestException } from '@nestjs/common';
import mongoose from 'mongoose';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';
import { Product, ProductSchema } from './schemas/product.schema.js';

describe('ProductsService field selection', () => {
  const productModel = new mongoose.Mongoose().model(Product.name, ProductSchema);
  const product = new productModel({
    title: 'Mascara',
    category: 'beauty',
    price: 9.99,
    createdBy: new mongoose.Types.ObjectId(),
  });
  let repository: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let inventoryService: {
    getQuantitiesByProductIds: ReturnType<typeof vi.fn>;
  };
  let service: ProductsService;

  beforeEach(() => {
    repository = {
      findAll: vi.fn().mockResolvedValue([product]),
      findById: vi.fn().mockResolvedValue(product),
    };
    inventoryService = {
      getQuantitiesByProductIds: vi.fn().mockResolvedValue(new Map()),
    };
    service = new ProductsService(
      repository as unknown as ProductsRepository,
      inventoryService as unknown as ConstructorParameters<
        typeof ProductsService
      >[1],
    );
  });

  it('returns only requested list fields and queries with a safe selection', async () => {
    const query = Object.assign(new ListProductsQueryDto(), {
      select: 'title,price',
    });

    await expect(service.findAll(query)).resolves.toEqual([
      { title: 'Mascara', price: 9.99 },
    ]);
    expect(repository.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      20,
      0,
      ['title', 'price'],
    );
    expect(
      inventoryService.getQuantitiesByProductIds,
    ).not.toHaveBeenCalled();
  });

  it('returns selected derived inventory fields and looks up inventory only when requested', async () => {
    inventoryService.getQuantitiesByProductIds.mockResolvedValue(
      new Map([
        [
          String(product._id),
          {
            id: 'inventory-id',
            quantity: 3,
            availabilityStatus: 'In Stock',
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      ]),
    );

    await expect(
      service.findOne(String(product._id), 'title,availabilityStatus'),
    ).resolves.toEqual({
      title: 'Mascara',
      availabilityStatus: 'In Stock',
    });
    expect(repository.findById).toHaveBeenCalledWith(
      String(product._id),
      ['title', 'availabilityStatus'],
    );
    expect(
      inventoryService.getQuantitiesByProductIds,
    ).toHaveBeenCalledOnce();
  });

  it('rejects a Mongo operator before querying products', async () => {
    const query = Object.assign(new ListProductsQueryDto(), {
      select: '$where',
    });

    await expect(service.findAll(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.findAll).not.toHaveBeenCalled();
  });
});
