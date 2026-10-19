import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsNumber, Min, ValidateIf } from 'class-validator';

export class UpdateInventoryDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a92' })
  @IsMongoId()
  businessId!: string;

  @ApiProperty({ type: 'number', example: 19.99, minimum: 0, required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ type: 'integer', example: 54, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
