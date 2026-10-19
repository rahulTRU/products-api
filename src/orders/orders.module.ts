import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Address, AddressSchema } from '../addresses/schemas/address.schema.js';
import { AddressesModule } from '../addresses/addresses.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { Business, BusinessSchema } from '../businesses/schemas/business.schema.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { Cart, CartSchema } from '../carts/schemas/cart.schema.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { Product, ProductSchema } from '../products/schemas/product.schema.js';
import { Order, OrderSchema } from './schemas/order.schema.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    AuthModule,
    AddressesModule,
    BusinessesModule,
    InventoryModule,
    PaymentsModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Business.name, schema: BusinessSchema },
      { name: Address.name, schema: AddressSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
