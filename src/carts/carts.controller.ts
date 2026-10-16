import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/auth-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../common/enums/auth.enum.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { ListCartsQueryDto } from './dto/list-carts-query.dto.js';
import { UpdateCartProductDto } from './dto/update-cart-product.dto.js';
import { CartsService } from './carts.service.js';

@Controller('carts')
@ApiTags('Carts')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all carts (admin only)' })
  @ApiOkResponse()
  findAll(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListCartsQueryDto,
  ) {
    return this.cartsService.findAll(user, query);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the current user's cart" })
  findMine(@CurrentUser() user: AuthPrincipal) {
    return this.cartsService.findMine(user);
  }

  @Put('me/products/:productId')
  @ApiOperation({
    summary: "Set a product quantity in the current user's cart",
  })
  putProductInMine(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateCartProductDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.cartsService.putProductInMine(productId, dto, user);
  }

  @Delete('me/products/:productId')
  @ApiOperation({
    summary: "Remove a product from the current user's cart",
  })
  removeProductFromMine(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.cartsService.removeProductFromMine(productId, user);
  }
}
