import { registerAs } from '@nestjs/config';
import { ConfigKey } from '../common/enums/config.enum.js';

export default registerAs('app', () => ({
  port: Number(process.env[ConfigKey.PORT] ?? 3000),
}));
