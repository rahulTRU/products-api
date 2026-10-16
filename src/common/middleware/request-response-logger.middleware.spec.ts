import { sanitizeForLogging } from './request-response-logger.middleware.js';

describe('sanitizeForLogging', () => {
  it('redacts sensitive fields and bounds payload size', () => {
    const sanitized = sanitizeForLogging({
      email: 'user@example.com',
      password: 'do-not-log',
      nested: { refreshToken: 'also-do-not-log' },
      longText: 'a'.repeat(2_100),
    }) as Record<string, unknown>;

    expect(sanitized).toMatchObject({
      email: '[REDACTED]',
      password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]' },
    });
    expect(sanitized.longText).toEqual(
      `${'a'.repeat(2_000)}…[truncated]`,
    );
  });
});
