import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUser } from '../auth/auth-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { AddressesService } from './addresses.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

@Controller('addresses')
@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's addresses" })
  @ApiOkResponse({ description: 'Addresses belonging to the current user' })
  findAll(@CurrentUser() user: AuthPrincipal) {
    return this.addressesService.findAll(user);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'MongoDB address ObjectId' })
  @ApiOperation({ summary: 'Get one of the current user’s addresses' })
  @ApiOkResponse({ description: 'Address belonging to the current user' })
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.addressesService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create an address for the current user' })
  @ApiCreatedResponse({ description: 'Address created' })
  create(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.addressesService.create(dto, user);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'MongoDB address ObjectId' })
  @ApiOperation({ summary: 'Update one of the current user’s addresses' })
  @ApiOkResponse({ description: 'Address updated' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.addressesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: 'MongoDB address ObjectId' })
  @ApiOperation({ summary: 'Delete one of the current user’s addresses' })
  @ApiNoContentResponse({ description: 'Address deleted' })
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.addressesService.remove(id, user);
  }
}
