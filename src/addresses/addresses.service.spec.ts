import { NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { UserRole } from '../common/enums/auth.enum.js';
import type { CreateAddressDto } from './dto/create-address.dto.js';
import type { UpdateAddressDto } from './dto/update-address.dto.js';
import { AddressesRepository } from './addresses.repository.js';
import { AddressesService } from './addresses.service.js';
import type { AddressDocument } from './schemas/address.schema.js';

const USER: AuthPrincipal = {
  id: '6ad241c4518543c0e9ca45c7',
  role: UserRole.BUYER,
};

function addressDocument(userId = USER.id): AddressDocument {
  return {
    toObject: () => ({
      _id: '65cb7f4a2d8b4c001f3e7a91',
      userId,
      googlePlaceId: 'ChIJ2eLE1mOWmwARsY5ptr4Jw80',
      formattedAddress:
        '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
      createdAt: new Date('2026-10-19T11:45:00.000Z'),
      updatedAt: new Date('2026-10-19T11:45:00.000Z'),
    }),
  } as unknown as AddressDocument;
}

describe('AddressesService', () => {
  let repository: {
    findByUserId: ReturnType<typeof vi.fn>;
    findOneForUser: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateForUser: ReturnType<typeof vi.fn>;
    deleteForUser: ReturnType<typeof vi.fn>;
    isUsedByBusiness: ReturnType<typeof vi.fn>;
  };
  let service: AddressesService;

  beforeEach(() => {
    repository = {
      findByUserId: vi.fn().mockResolvedValue([addressDocument()]),
      findOneForUser: vi.fn().mockResolvedValue(addressDocument()),
      create: vi.fn().mockResolvedValue(addressDocument()),
      updateForUser: vi.fn().mockResolvedValue(addressDocument()),
      deleteForUser: vi.fn().mockResolvedValue(true),
      isUsedByBusiness: vi.fn().mockResolvedValue(false),
    };
    service = new AddressesService(
      repository as unknown as AddressesRepository,
    );
  });

  it('lists only the authenticated user’s addresses and includes the owner id', async () => {
    const result = await service.findAll(USER);

    expect(repository.findByUserId).toHaveBeenCalledWith(USER.id);
    expect(result[0]).toHaveProperty('userId', USER.id);
    expect(result[0]).toMatchObject({
      _id: '65cb7f4a2d8b4c001f3e7a91',
      formattedAddress:
        '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
    });
  });

  it('scopes read, update, and delete by both address id and authenticated user id', async () => {
    const addressId = '65cb7f4a2d8b4c001f3e7a91';

    await service.findOne(addressId, USER);
    await service.update(addressId, { formattedAddress: 'Updated' }, USER);
    await service.remove(addressId, USER);

    expect(repository.findOneForUser).toHaveBeenCalledWith(addressId, USER.id);
    expect(repository.updateForUser).toHaveBeenCalledWith(
      addressId,
      USER.id,
      { formattedAddress: 'Updated' } satisfies UpdateAddressDto,
    );
    expect(repository.deleteForUser).toHaveBeenCalledWith(
      addressId,
      USER.id,
    );
  });

  it('sets the owner from the authenticated principal on create', async () => {
    const payload = {
      formattedAddress: 'Mountain View, CA',
    } satisfies CreateAddressDto;

    await service.create(payload, USER);
    expect(repository.create).toHaveBeenCalledWith(USER.id, payload);
  });

  it('returns 404 when an address is not owned by the current user', async () => {
    repository.findOneForUser.mockResolvedValue(null);
    repository.updateForUser.mockResolvedValue(null);
    repository.deleteForUser.mockResolvedValue(false);

    await expect(
      service.findOne('65cb7f4a2d8b4c001f3e7a91', USER),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update(
        '65cb7f4a2d8b4c001f3e7a91',
        { formattedAddress: 'Not mine' },
        USER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.remove('65cb7f4a2d8b4c001f3e7a91', USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents deleting an address referenced by a business', async () => {
    repository.isUsedByBusiness.mockResolvedValue(true);

    await expect(
      service.remove('65cb7f4a2d8b4c001f3e7a91', USER),
    ).rejects.toThrow(
      'Remove this address from its business service areas before deleting it',
    );
    expect(repository.deleteForUser).not.toHaveBeenCalled();
  });
});
