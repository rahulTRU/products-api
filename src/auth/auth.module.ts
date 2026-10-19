import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { Address, AddressSchema } from '../addresses/schemas/address.schema.js';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Address.name, schema: AddressSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AccessTokenGuard, RolesGuard],
  exports: [AccessTokenGuard, AuthService, JwtModule, RolesGuard],
})
export class AuthModule {}
