import { NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { UserRole } from '../common/enums/auth.enum.js';
import { AddressesService } from '../addresses/addresses.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const USER: AuthPrincipal = {
  id: '6ad241c4518543c0e9ca45c7',
  role: UserRole.BUYER,
};
const ADDRESS_ID = '65cb7f4a2d8b4c001f3e7a91';

describe('UsersService', () => {
  let addressesService: { findOne: ReturnType<typeof vi.fn> };
  let usersRepository: {
    updateLatestSelectedAddress: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  beforeEach(() => {
    addressesService = { findOne: vi.fn().mockResolvedValue({ _id: ADDRESS_ID }) };
    usersRepository = {
      updateLatestSelectedAddress: vi.fn().mockResolvedValue({
        latestSelectedAddressId: { toString: () => ADDRESS_ID },
      }),
    };
    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      addressesService as unknown as AddressesService,
    );
  });

  it('verifies ownership and updates only the authenticated user record', async () => {
    await expect(
      service.selectLatestAddress({ addressId: ADDRESS_ID }, USER),
    ).resolves.toEqual({ latestSelectedAddressId: ADDRESS_ID });

    expect(addressesService.findOne).toHaveBeenCalledWith(ADDRESS_ID, USER);
    expect(
      usersRepository.updateLatestSelectedAddress,
    ).toHaveBeenCalledWith(USER.id, ADDRESS_ID);
  });

  it('does not update user when the address does not belong to them', async () => {
    addressesService.findOne.mockRejectedValue(
      new NotFoundException('Address was not found'),
    );

    await expect(
      service.selectLatestAddress({ addressId: ADDRESS_ID }, USER),
    ).rejects.toThrow('Address was not found for this user');
    expect(
      usersRepository.updateLatestSelectedAddress,
    ).not.toHaveBeenCalled();
  });

  it('returns not found if the authenticated user record is missing', async () => {
    usersRepository.updateLatestSelectedAddress.mockResolvedValue(null);

    await expect(
      service.selectLatestAddress({ addressId: ADDRESS_ID }, USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
