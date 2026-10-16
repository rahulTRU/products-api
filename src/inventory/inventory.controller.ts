import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'List all inventory for admins or own inventory for sellers',
  })
  findAll(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListInventoryQueryDto,
  ) {
    return this.inventoryService.findAll(user, query);
  }

  @Get('me')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: "List the current seller's inventory" })
  findMine(
    @CurrentUser() _user: AuthPrincipal,
    @Query() _query: ListInventoryQueryDto,
  ) {
    this.logger.log('Reached GET /inventory/me handler');
    return {"success":"true","message":"This endpoint is currently disabled. Please use the /inventory endpoint with your seller account to view your inventory."}
    // return this.inventoryService.findMine(user, query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get inventory for a product' })
  findByProductId(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.inventoryService.findByProductId(productId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create inventory for a product' })
  create(
    @Body() dto: CreateInventoryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.inventoryService.create(dto, user);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Set inventory quantity for a product' })
  updateQuantity(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.inventoryService.updateQuantity(productId, dto, user);
  }
}
