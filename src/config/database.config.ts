import { registerAs } from '@nestjs/config';
import {
  DatabaseConfigKey,
  DatabaseType,
} from '../common/enums/database.enum.js';

export default registerAs('database', () => ({
  type: DatabaseType.MONGODB,
  uri:
    process.env[DatabaseConfigKey.MONGODB_URI] ??
    'mongodb://127.0.0.1:27017/products-api',
}));
