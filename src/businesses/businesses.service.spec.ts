import { NotFoundException } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository.js';
import { BusinessesService } from './businesses.service.js';

describe('BusinessesService', () => {
  const user = {
    id: '6ad241c4518543c0e9ca45c7',
    role: 'buyer' as const,
  };
  const addressId = '65cb7f4a2d8b4c001f3e7a91';

  it('creates an owner-scoped business and enables seller capability', async () => {
    const business = {
      _id: { toString: () => '65cb7f4a2d8b4c001f3e7a92' },
      ownerId: { toString: () => user.id },
      businessName: 'Rahul Fresh Store',
      addressIds: [{ toString: () => addressId }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repository = {
      create: vi.fn().mockResolvedValue(business),
    };
    const addressesService = {
      findOne: vi.fn().mockResolvedValue({
        _id: addressId,
        formattedAddress: 'Raleigh, NC',
      }),
    };
    const userModel = {
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    };
    const inventoryModel = { exists: vi.fn().mockResolvedValue(null) };
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: vi.fn(),
    };
    const connection = {
      startSession: vi.fn().mockResolvedValue(session),
    };
    const service = new BusinessesService(
      repository as unknown as BusinessesRepository,
      addressesService as never,
      userModel as never,
      inventoryModel as never,
      connection as never,
    );

    await expect(
      service.create(
        { businessName: ' Rahul Fresh Store ', addressIds: [addressId] },
        user,
      ),
    ).resolves.toMatchObject({
      ownerId: user.id,
      businessName: 'Rahul Fresh Store',
      addressIds: [addressId],
      addresses: [{ id: addressId, formattedAddress: 'Raleigh, NC' }],
    });
    expect(repository.create).toHaveBeenCalledWith(
      user.id,
      'Rahul Fresh Store',
      [addressId],
      session,
    );
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { sellerEnabled: true } },
      { session },
    );
  });

  it('does not create a business using an address not owned by its user', async () => {
    const repository = { create: vi.fn() };
    const addressesService = {
      findOne: vi.fn().mockRejectedValue(new NotFoundException()),
    };
    const service = new BusinessesService(
      repository as unknown as BusinessesRepository,
      addressesService as never,
      { updateOne: vi.fn() } as never,
      { exists: vi.fn().mockResolvedValue(null) } as never,
      { startSession: vi.fn() } as never,
    );

    await expect(
      service.create({ businessName: 'Store', addressIds: [addressId] }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
