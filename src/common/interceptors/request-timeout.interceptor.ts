import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  catchError,
  Observable,
  throwError,
  TimeoutError,
  timeout,
} from 'rxjs';

export const REQUEST_TIMEOUT_MS = 120_000;

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout({ first: REQUEST_TIMEOUT_MS }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new GatewayTimeoutException(
                'Request timed out after 120 seconds',
              ),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
