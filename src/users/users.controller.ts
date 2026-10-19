import {
  Body,
  Controller,
  Patch,
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
import { SelectLatestAddressDto } from './dto/select-latest-address.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('latest-address')
  @ApiOperation({
    summary: 'Set the current user’s most recently selected address',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        latestSelectedAddressId: { type: 'string' },
      },
    },
  })
  selectLatestAddress(
    @Body() dto: SelectLatestAddressDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.usersService.selectLatestAddress(dto, user);
  }
}
