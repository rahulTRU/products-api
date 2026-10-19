import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { FakePaymentGateway } from './fake-payment.gateway.js';

describe('FakePaymentGateway', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    'simulated_succeeded',
    'simulated_failed',
  ] as const)('returns the configured result %s outside production', async (result) => {
    vi.stubEnv('NODE_ENV', 'test');
    const configService = {
      getOrThrow: vi.fn().mockReturnValue(result),
    };
    const gateway = new FakePaymentGateway(configService as unknown as ConfigService);

    await expect(gateway.charge()).resolves.toBe(result);
  });

  it('does not simulate a payment in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const gateway = new FakePaymentGateway({
      getOrThrow: vi.fn().mockReturnValue('simulated_succeeded'),
    } as unknown as ConfigService);

    await expect(gateway.charge()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
