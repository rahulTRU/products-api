import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductDimensionsDto {
  @ApiProperty({ example: 15.14, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  width!: number;

  @ApiProperty({ example: 13.08, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  height!: number;

  @ApiProperty({ example: 22.99, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depth!: number;
}

export class ProductReviewDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ example: 'Very satisfied!' })
  @IsString()
  @IsNotEmpty()
  comment!: string;

  @ApiProperty({ example: '2025-04-30T09:41:02.053Z' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: 'Lucas Gordon' })
  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @ApiProperty({ example: 'lucas.gordon@example.com' })
  @IsEmail()
  reviewerEmail!: string;
}

export class ProductMetadataDto {
  @ApiPropertyOptional({ example: '2025-10-09T14:47:01.588Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-05-23T11:27:41.868Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updatedAt?: Date;

  @ApiPropertyOptional({ example: '5784719087687' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 'https://example.com/qr-code.png' })
  @IsOptional()
  @IsUrl()
  qrCode?: string;
}

export class CreateProductDto {
  @ApiPropertyOptional({
    description: 'Optional source-system ID; MongoDB _id remains the API ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceId?: number;

  @ApiProperty({ example: 'Essence Mascara Lash Princess' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'beauty' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({ example: 'A volumizing and lengthening mascara.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 9.99, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 10.48, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ example: 4.5, minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: [String], example: ['beauty', 'mascara'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Essence' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'BEA-ESS-ESS-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 4, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ type: ProductDimensionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ example: '1 week warranty' })
  @IsOptional()
  @IsString()
  warrantyInformation?: string;

  @ApiPropertyOptional({ example: 'Ships in 3-5 business days' })
  @IsOptional()
  @IsString()
  shippingInformation?: string;

  @ApiPropertyOptional({ type: [ProductReviewDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductReviewDto)
  reviews?: ProductReviewDto[];

  @ApiPropertyOptional({ example: 'No return policy' })
  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @ApiPropertyOptional({ example: 48, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({ type: ProductMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductMetadataDto)
  meta?: ProductMetadataDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/product.webp'],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({ example: 'https://example.com/thumbnail.webp' })
  @IsOptional()
  @IsUrl()
  thumbnail?: string;
}
