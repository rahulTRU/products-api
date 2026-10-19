import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
