import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

describe('AuthService current user response', () => {
  let authRepository: {
    findById: ReturnType<typeof vi.fn>;
    findOwnedAddressSummary: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    authRepository = {
      findById: vi.fn().mockResolvedValue({
        _id: '6ad241c4518543c0e9ca45c7',
        username: 'seller1',
        email: 'seller@example.com',
        firstName: 'Seller',
        lastName: 'One',
        gender: 'other',
        role: 'seller',
        image: '',
        latestSelectedAddressId: null,
      }),
      findOwnedAddressSummary: vi.fn(),
    };
    service = new AuthService(
      authRepository as unknown as AuthRepository,
      {} as JwtService,
      {} as ConfigService,
    );
  });

  it('returns the selected address without a duplicate top-level address ID', async () => {
    authRepository.findById.mockResolvedValue({
      _id: '6ad241c4518543c0e9ca45c7',
      username: 'seller1',
      email: 'seller@example.com',
      firstName: 'Seller',
      lastName: 'One',
      gender: 'other',
      role: 'seller',
      image: '',
      latestSelectedAddressId: {
        toString: () => '65cb7f4a2d8b4c001f3e7a91',
      },
    });
    authRepository.findOwnedAddressSummary.mockResolvedValue({
      _id: '65cb7f4a2d8b4c001f3e7a91',
      formattedAddress:
        '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
    });

    await expect(
      service.getAuthUser('6ad241c4518543c0e9ca45c7'),
    ).resolves.toEqual({
      id: '6ad241c4518543c0e9ca45c7',
      username: 'seller1',
      email: 'seller@example.com',
      firstName: 'Seller',
      lastName: 'One',
      gender: 'other',
      role: 'seller',
      image: '',
      latestSelectedAddress: {
        id: '65cb7f4a2d8b4c001f3e7a91',
        formattedAddress:
          '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
      },
    });
    expect(authRepository.findOwnedAddressSummary).toHaveBeenCalledWith(
      '65cb7f4a2d8b4c001f3e7a91',
      '6ad241c4518543c0e9ca45c7',
    );
  });

  it('returns null for users without a selected address', async () => {
    await expect(
      service.getAuthUser('6ad241c4518543c0e9ca45c7'),
    ).resolves.toMatchObject({ latestSelectedAddress: null });
    expect(authRepository.findOwnedAddressSummary).not.toHaveBeenCalled();
  });

  it('does not expose a selected address that is not owned by the user', async () => {
    authRepository.findById.mockResolvedValue({
      _id: '6ad241c4518543c0e9ca45c7',
      username: 'seller1',
      email: 'seller@example.com',
      firstName: 'Seller',
      lastName: 'One',
      gender: 'other',
      role: 'seller',
      image: '',
      latestSelectedAddressId: {
        toString: () => '65cb7f4a2d8b4c001f3e7a91',
      },
    });
    authRepository.findOwnedAddressSummary.mockResolvedValue(null);

    await expect(
      service.getAuthUser('6ad241c4518543c0e9ca45c7'),
    ).resolves.toMatchObject({ latestSelectedAddress: null });
  });

  it('keeps rejecting invalid user IDs before repository lookup', async () => {
    await expect(service.getAuthUser('invalid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authRepository.findById).not.toHaveBeenCalled();
  });
});
