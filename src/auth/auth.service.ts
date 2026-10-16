import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TokenType, UserRole } from '../common/enums/auth.enum.js';
import { AuthRepository } from './auth.repository.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import { AuthResponse, AuthUserResponse, TokenPayload } from './auth.types.js';
import { UserDocument } from '../users/schemas/user.schema.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    if (
      await this.authRepository.existsByUsernameOrEmail(username, email)
    ) {
      throw new ConflictException('Username or email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user: UserDocument;
    try {
      user = await this.authRepository.createUser({
        username,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        role: UserRole.BUYER,
        image: dto.image ?? '',
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Username or email is already registered');
      }
      throw error;
    }

    const result = await this.issueTokens(user);
    this.logger.log(`Created account ${String(user._id)}`);
    return result;
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.authRepository.findByEmailWithPassword(
      dto.email.trim().toLowerCase(),
    );
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const result = await this.issueTokens(user);
    this.logger.log(`Authenticated account ${String(user._id)}`);
    return result;
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (
      payload.type !== TokenType.REFRESH ||
      !isValidObjectId(payload.sub)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user =
      await this.authRepository.findByIdWithRefreshTokenHash(payload.sub);
    if (
      !user?.refreshTokenHash ||
      !matchesHash(refreshToken, user.refreshTokenHash)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const result = await this.issueTokens(user, user.refreshTokenHash);
    this.logger.log(`Rotated refresh token for account ${String(user._id)}`);
    return result;
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.clearRefreshTokenHash(userId);
    this.logger.log(`Logged out account ${userId}`);
  }

  async getAuthUser(userId: string): Promise<AuthUserResponse> {
    if (!isValidObjectId(userId)) {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return toAuthUser(user);
  }

  private async issueTokens(
    user: UserDocument,
    expectedRefreshHash?: string,
  ): Promise<AuthResponse> {
    const payload: TokenPayload = {
      sub: String(user._id),
      type: TokenType.ACCESS,
      role: user.role,
    };
    const refreshPayload: TokenPayload = {
      sub: String(user._id),
      type: TokenType.REFRESH,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('auth.accessSecret'),
        expiresIn: this.configService.getOrThrow<number>(
          'auth.accessTtlSeconds',
        ),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
        expiresIn: this.configService.getOrThrow<number>(
          'auth.refreshTtlSeconds',
        ),
      }),
    ]);
    const refreshTokenHash = hashToken(refreshToken);

    const updated = await this.authRepository.updateRefreshTokenHash(
      user,
      refreshTokenHash,
      expectedRefreshHash,
    );
    if (expectedRefreshHash && !updated) {
      throw new UnauthorizedException('Refresh token has already been used');
    }

    return { ...toAuthUser(user), accessToken, refreshToken };
  }
}

function toAuthUser(user: UserDocument): AuthUserResponse {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    role: user.role,
    image: user.image,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function matchesHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
