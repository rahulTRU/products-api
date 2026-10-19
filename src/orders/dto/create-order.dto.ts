import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsMongoId, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a91' })
  @IsMongoId()
  addressId!: string;

  @ApiProperty({ example: '2026-10-20T03:30:00.000Z' })
  @IsISO8601()
  deliveryWindowStart!: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  @IsString()
  @MaxLength(80)
  timeZone!: string;
}
