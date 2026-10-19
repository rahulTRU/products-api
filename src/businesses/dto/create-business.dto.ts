import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Rahul Fresh Store', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  businessName!: string;

  @ApiProperty({
    type: [String],
    example: ['65cb7f4a2d8b4c001f3e7a91'],
    description: 'IDs of this owner’s addresses used for business delivery',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  addressIds!: string[];
}
