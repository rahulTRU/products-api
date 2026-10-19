import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '../common/enums/auth.enum.js';
import type { AuthPrincipal } from './auth.types.js';
import { ROLES_KEY } from './roles.decorator.js';

type AuthenticatedRequest = Request & { user: AuthPrincipal };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hasSellerCapability =
      roles.includes(UserRole.SELLER) && request.user.sellerEnabled === true;
    if (!roles.includes(request.user.role) && !hasSellerCapability) {
      throw new ForbiddenException(
        `Role ${roles.join(' or ')} required to access this resource`,
      );
    }
    return true;
  }
}
