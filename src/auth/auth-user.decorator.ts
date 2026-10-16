import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUserResponse } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUserResponse =>
    context.switchToHttp().getRequest<Request & { user: AuthUserResponse }>()
      .user,
);
