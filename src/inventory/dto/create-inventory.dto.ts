import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsNumber, Min } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a92' })
  @IsMongoId()
  businessId!: string;

  @ApiProperty({ type: 'number', example: 19.99, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ type: 'integer', example: 54, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
