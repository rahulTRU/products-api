import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { Product, ProductSchema } from '../products/schemas/product.schema.js';
import { Business, BusinessSchema } from '../businesses/schemas/business.schema.js';
import { CartsController } from './carts.controller.js';
import { CartsRepository } from './carts.repository.js';
import { CartsService } from './carts.service.js';
import { Cart, CartSchema } from './schemas/cart.schema.js';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [CartsController],
  providers: [CartsRepository, CartsService],
})
export class CartsModule {}
