import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/auth-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('delivery-windows')
  @ApiOperation({
    summary: 'List hourly windows with at least two hours of preparation time',
  })
  @ApiQuery({
    name: 'timeZone',
    required: true,
    example: 'Asia/Kolkata',
    description: 'IANA timezone used to align and display hourly windows',
  })
  getAvailableDeliveryWindows(@Query('timeZone') timeZone: string) {
    return this.ordersService.getAvailableDeliveryWindows(timeZone);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthPrincipal) {
    return this.ordersService.findMine(user);
  }

  @Post()
  @ApiOperation({
    summary:
      'Validate the cart, reserve stock, simulate payment, and create an order',
  })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.ordersService.create(dto, user);
  }

  @Get(':orderId')
  findOne(
    @Param('orderId', ParseObjectIdPipe) orderId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.ordersService.findOne(orderId, user);
  }
}
