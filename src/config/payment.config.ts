import { registerAs } from '@nestjs/config';
import { ConfigKey } from '../common/enums/config.enum.js';

const ALLOWED_RESULTS = ['simulated_succeeded', 'simulated_failed'] as const;

export default registerAs('payments', () => {
  const result = process.env[ConfigKey.FAKE_PAYMENT_RESULT] ??
    'simulated_succeeded';
  if (!ALLOWED_RESULTS.includes(result as (typeof ALLOWED_RESULTS)[number])) {
    throw new Error(
      `${ConfigKey.FAKE_PAYMENT_RESULT} must be one of ${ALLOWED_RESULTS.join(', ')}`,
    );
  }
  return { fakeResult: result };
});
