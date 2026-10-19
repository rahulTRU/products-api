import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateInventoryDto {
  @ApiProperty({ type: 'integer', example: 54, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
