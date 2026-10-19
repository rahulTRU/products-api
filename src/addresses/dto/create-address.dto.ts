import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressComponentsDto } from './address-components.dto.js';
import { AddressLocationDto } from './address-location.dto.js';
import { AddressMetadataDto } from './address-metadata.dto.js';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'ChIJ2eLE1mOWmwARsY5ptr4Jw80' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  googlePlaceId?: string;

  @ApiProperty({
    example: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  })
  @IsString()
  @MaxLength(1000)
  formattedAddress!: string;

  @ApiPropertyOptional({ type: AddressComponentsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressComponentsDto)
  components?: AddressComponentsDto;

  @ApiPropertyOptional({ type: AddressLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressLocationDto)
  location?: AddressLocationDto;

  @ApiPropertyOptional({ type: AddressMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressMetadataDto)
  metadata?: AddressMetadataDto;
}
