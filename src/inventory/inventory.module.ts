import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { AddressesModule } from '../addresses/addresses.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { Business, BusinessSchema } from '../businesses/schemas/business.schema.js';
import { Product, ProductSchema } from '../products/schemas/product.schema.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';
import { Inventory, InventorySchema } from './schemas/inventory.schema.js';

@Module({
  imports: [
    AuthModule,
    AddressesModule,
    BusinessesModule,
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
