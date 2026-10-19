import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'geoJsonCoordinates', async: false })
class GeoJsonCoordinatesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      !value.every((coordinate) => typeof coordinate === 'number')
    ) {
      return false;
    }
    const [longitude, latitude] = value as number[];
    return (
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90
    );
  }

  defaultMessage(): string {
    return 'coordinates must be [longitude, latitude] within valid geographic ranges';
  }
}

export class AddressLocationDto {
  @ApiProperty({ example: 'Point', enum: ['Point'] })
  @IsIn(['Point'])
  type = 'Point' as const;

  @ApiProperty({
    type: [Number],
    minItems: 2,
    maxItems: 2,
    example: [-122.0842499, 37.4220656],
    description: '[longitude, latitude]',
  })
  @Type(() => Number)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Validate(GeoJsonCoordinatesConstraint)
  coordinates!: [number, number];
}
