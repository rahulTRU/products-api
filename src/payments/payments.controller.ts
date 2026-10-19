import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/auth-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthPrincipal) {
    return this.paymentsService.findMine(user.id);
  }

  @Get(':paymentId')
  findOne(
    @Param('paymentId', ParseObjectIdPipe) paymentId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.paymentsService.findOne(paymentId, user.id);
  }
}
