import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from './auth-user.decorator.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthService } from './auth.service.js';
import {
  AuthResponseDto,
  AuthUserResponseDto,
} from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import type { AuthResponse, AuthUserResponse } from './auth.types.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({
    description: 'Account created and tokens issued',
    type: AuthResponseDto,
  })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.signup(dto);
    setAuthCookies(response, result, this.configService);
    return result;
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Authenticated and tokens issued',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto);
    setAuthCookies(response, result, this.configService);
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token' })
  @ApiCookieAuth('refreshToken')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiOkResponse({ description: 'Tokens rotated', type: AuthResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body('refreshToken') bodyToken?: string,
  ): Promise<AuthResponse> {
    const refreshToken = request.cookies?.refreshToken ?? bodyToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, result, this.configService);
    return result;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Log out and revoke the refresh token' })
  @ApiOkResponse({ description: 'Logged out' })
  async logout(
    @CurrentUser() user: AuthUserResponse,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    clearAuthCookies(response);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({
    description: 'Current user profile',
    type: AuthUserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getCurrentUser(@CurrentUser() user: AuthUserResponse): AuthUserResponse {
    return user;
  }
}

function setAuthCookies(
  response: Response,
  result: AuthResponse,
  configService: ConfigService,
): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: configService.getOrThrow<number>('auth.accessTtlSeconds') * 1000,
  });
  response.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
    maxAge: configService.getOrThrow<number>('auth.refreshTtlSeconds') * 1000,
  });
}

function clearAuthCookies(response: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  response.clearCookie('accessToken', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  response.clearCookie('refreshToken', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
  });
}
