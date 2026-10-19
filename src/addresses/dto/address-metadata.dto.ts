import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddressMetadataDto {
  @ApiPropertyOptional({ example: 'googlehq' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rawUserInput?: string;

}
