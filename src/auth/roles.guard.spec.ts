import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../common/enums/auth.enum.js';
import { ROLES_KEY } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  it('rejects a buyer from a seller-only route with an explicit 403', () => {
    const getAllAndOverride = vi.fn().mockReturnValue([UserRole.SELLER]);
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.BUYER } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Role seller required to access this resource'),
    );
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('allows buyer accounts with the seller capability', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.SELLER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: UserRole.BUYER, sellerEnabled: true },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
