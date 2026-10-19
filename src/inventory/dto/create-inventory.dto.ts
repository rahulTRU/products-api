import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ type: 'integer', example: 54, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
