import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddressesModule } from '../addresses/addresses.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesRepository } from './businesses.repository.js';
import { BusinessesService } from './businesses.service.js';
import { Business, BusinessSchema } from './schemas/business.schema.js';

@Module({
  imports: [
    AuthModule,
    AddressesModule,
    MongooseModule.forFeature([
      { name: Business.name, schema: BusinessSchema },
      { name: User.name, schema: UserSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  controllers: [BusinessesController],
  providers: [BusinessesRepository, BusinessesService],
  exports: [BusinessesService, BusinessesRepository],
})
export class BusinessesModule {}
