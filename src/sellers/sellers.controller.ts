import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/auth-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../common/enums/auth.enum.js';
import { SellersService } from './sellers.service.js';

@Controller('seller')
@ApiTags('Seller')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.SELLER)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get('sales')
  @ApiOperation({
    summary: 'Get simulated gross sales and item counts for owned businesses',
  })
  getGrossSales(@CurrentUser() user: AuthPrincipal) {
    return this.sellersService.getGrossSales(user.id);
  }
}
