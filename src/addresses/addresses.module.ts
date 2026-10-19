import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { AddressesController } from './addresses.controller.js';
import { AddressesRepository } from './addresses.repository.js';
import { AddressesService } from './addresses.service.js';
import { Address, AddressSchema } from './schemas/address.schema.js';
import { Business, BusinessSchema } from '../businesses/schemas/business.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Address.name, schema: AddressSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [AddressesController],
  providers: [AddressesRepository, AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
