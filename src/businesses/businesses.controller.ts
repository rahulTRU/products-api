import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { BusinessesService } from './businesses.service.js';

@Controller('businesses')
@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('me')
  @ApiOperation({ summary: 'List businesses owned by the current user' })
  findMine(@CurrentUser() user: AuthPrincipal) {
    return this.businessesService.findMine(user);
  }

  @Get(':businessId')
  findOne(
    @Param('businessId', ParseObjectIdPipe) businessId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.businessesService.findOne(businessId, user);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a business and enable seller capability for the owner',
  })
  create(
    @Body() dto: CreateBusinessDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.businessesService.create(dto, user);
  }

  @Patch(':businessId')
  update(
    @Param('businessId', ParseObjectIdPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.businessesService.update(businessId, dto, user);
  }

  @Delete(':businessId')
  remove(
    @Param('businessId', ParseObjectIdPipe) businessId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.businessesService.remove(businessId, user);
  }
}
