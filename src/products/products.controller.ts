import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../common/enums/auth.enum.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter products' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Case-insensitive search in product titles',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['title', 'updatedAt'],
    example: 'title',
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'modifiedAfter',
    required: false,
    description: 'Inclusive ISO date bound for the product updatedAt timestamp',
  })
  @ApiQuery({
    name: 'modifiedBefore',
    required: false,
    description: 'Inclusive ISO date bound for the product updatedAt timestamp',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({
    name: 'offset',
    required: false,
    deprecated: true,
    description: 'Use skip instead',
  })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List products created by the current user' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  findMine(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService.findMine(user.id, query);
  }

  @Get('categories')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List distinct product categories' })
  findCategories() {
    return this.productsService.findCategories();
  }

  @Get('category/:category')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List products in a category' })
  findByCategory(
    @Param('category') category: string,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService.findByCategory(category, query);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.productsService.create(createProductDto, user.id);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.productsService.update(id, updateProductDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.productsService.remove(id, user.id);
  }
}
