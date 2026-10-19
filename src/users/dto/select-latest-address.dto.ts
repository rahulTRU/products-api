import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class SelectLatestAddressDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a91' })
  @IsMongoId()
  addressId!: string;
}
