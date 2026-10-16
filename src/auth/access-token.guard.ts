import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TokenType } from '../common/enums/auth.enum.js';
import { AuthService } from './auth.service.js';
import { AuthUserResponse, TokenPayload } from './auth.types.js';

type AuthenticatedRequest = Request & { user: AuthUserResponse };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
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

    if (payload.type !== TokenType.ACCESS) {
      throw new UnauthorizedException('Invalid access token');
    }
    request.user = await this.authService.getAuthUser(payload.sub);
    return true;
  }
}
