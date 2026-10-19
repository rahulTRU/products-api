import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class UpdateCartProductDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a92' })
  @IsMongoId()
  businessId!: string;

  @ApiProperty({ example: 3, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
