import {
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const MAX_LOG_VALUE_LENGTH = 2_000;
const MAX_LOG_PAYLOAD_LENGTH = 6_000;
const SENSITIVE_FIELD =
  /authorization|cookie|password|token|secret|api[-_]?key|email|phone/i;

@Injectable()
export class RequestResponseLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestResponseLoggerMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const requestTime = new Date(startedAt).toISOString();
    const requestPayload = boundedPayload({
      query: request.query,
      body: request.body,
    });
    let responsePayload: unknown;
    let logged = false;

    this.logger.log(
      JSON.stringify({
        event: 'request.started',
        timestamp: requestTime,
        method: request.method,
        path: request.path,
        request: requestPayload,
      }),
    );

    const originalSend = response.send.bind(response);
    response.send = ((body?: unknown) => {
      responsePayload = boundedPayload(sanitizeResponseBody(body));
      return originalSend(
        body as Parameters<Response['send']>[0],
      );
    }) as Response['send'];

    const logCompletion = (aborted: boolean): void => {
      if (logged) {
        return;
      }
      logged = true;
      this.logger.log(
        JSON.stringify({
          event: 'request.completed',
          timestamp: requestTime,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          request: requestPayload,
          response: responsePayload,
          ...(aborted && { aborted: true }),
        }),
      );
    };

    response.once('finish', () => logCompletion(false));
    response.once('close', () => {
      if (!response.writableFinished) {
        logCompletion(true);
      }
    });

    next();
  }
}

export function sanitizeForLogging(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 5) {
    return '[Max depth]';
  }
  if (typeof value === 'string') {
    return value.length > MAX_LOG_VALUE_LENGTH
      ? `${value.slice(0, MAX_LOG_VALUE_LENGTH)}…[truncated]`
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeForLogging(item, depth + 1));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer: ${value.length} bytes]`;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          SENSITIVE_FIELD.test(key)
            ? '[REDACTED]'
            : sanitizeForLogging(item, depth + 1),
        ]),
    );
  }
  return value;
}

function sanitizeResponseBody(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return sanitizeForLogging(JSON.parse(body) as unknown);
    } catch {
      return sanitizeForLogging(body);
    }
  }
  return sanitizeForLogging(body);
}

function boundedPayload(value: unknown): unknown {
  const sanitized = sanitizeForLogging(value);
  const serialized = JSON.stringify(sanitized);
  if (serialized === undefined || serialized.length <= MAX_LOG_PAYLOAD_LENGTH) {
    return sanitized;
  }
  return {
    truncated: true,
    preview: `${serialized.slice(0, MAX_LOG_PAYLOAD_LENGTH)}…`,
  };
}
