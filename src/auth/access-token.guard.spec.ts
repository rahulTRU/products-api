import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard.js';

function createContext() {
  const request = {
    headers: { authorization: 'Bearer token' },
    method: 'GET',
    path: '/inventory/me',
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

function createGuard(payload: unknown): AccessTokenGuard {
  const jwtService = {
    verifyAsync: vi.fn().mockResolvedValue(payload),
  } as unknown as JwtService;
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;
  return new AccessTokenGuard(jwtService, configService);
}

describe('AccessTokenGuard', () => {
  it('authenticates from the signed user ID and role without loading the user from MongoDB', async () => {
    const guard = createGuard({
      sub: '6ad241c4518543c0e9ca45c7',
      type: 'access',
      role: 'buyer',
    });
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      id: '6ad241c4518543c0e9ca45c7',
      role: 'buyer',
    });
  });

  it('rejects old access tokens without a role and asks the user to sign in again', async () => {
    const guard = createGuard({
      sub: '6ad241c4518543c0e9ca45c7',
      type: 'access',
    });
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is outdated; sign in again'),
    );
  });
});
