import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
} from '@nestjs/common';
import { firstValueFrom, NEVER } from 'rxjs';
import { RequestTimeoutInterceptor } from './request-timeout.interceptor.js';

describe('RequestTimeoutInterceptor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a gateway timeout when a handler exceeds two minutes', async () => {
    vi.useFakeTimers();
    const interceptor = new RequestTimeoutInterceptor();
    const handler: CallHandler = { handle: () => NEVER };
    const response = firstValueFrom(
      interceptor.intercept({} as ExecutionContext, handler),
    );
    const timedOut = expect(response).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );

    await vi.advanceTimersByTimeAsync(120_000);

    await timedOut;
  });
});
