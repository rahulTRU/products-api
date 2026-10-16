import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isValidObjectId } from 'mongoose';
import type { Request } from 'express';
import { TokenType, UserRole } from '../common/enums/auth.enum.js';
import type { AuthPrincipal, TokenPayload } from './auth.types.js';

type AuthenticatedRequest = Request & { user: AuthPrincipal };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : request.cookies?.accessToken;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('auth.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== TokenType.ACCESS || !isValidObjectId(payload.sub)) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!payload.role) {
      throw new UnauthorizedException(
        'Access token is outdated; sign in again',
      );
    }
    if (!Object.values(UserRole).includes(payload.role)) {
      throw new UnauthorizedException('Invalid access token');
    }
    request.user = { id: payload.sub, role: payload.role };
    return true;
  }
}
