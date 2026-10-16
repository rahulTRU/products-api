import { registerAs } from '@nestjs/config';
import { ConfigKey } from '../common/enums/config.enum.js';

function readTtl(key: ConfigKey, defaultValue: number): number {
  const value = Number(process.env[key] ?? defaultValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

export default registerAs('auth', () => {
  const accessSecret = process.env[ConfigKey.JWT_ACCESS_SECRET];
  const refreshSecret = process.env[ConfigKey.JWT_REFRESH_SECRET];

  if (!accessSecret || accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    throw new Error(
      'JWT_REFRESH_SECRET must be set and at least 32 characters',
    );
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT access and refresh secrets must be different');
  }

  return {
    accessSecret,
    refreshSecret,
    accessTtlSeconds: readTtl(ConfigKey.JWT_ACCESS_TTL_SECONDS, 900),
    refreshTtlSeconds: readTtl(ConfigKey.JWT_REFRESH_TTL_SECONDS, 604800),
  };
});
