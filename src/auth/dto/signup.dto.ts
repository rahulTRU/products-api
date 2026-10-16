import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserGender } from '../../common/enums/auth.enum.js';

export class SignupDto {
  @ApiProperty({ example: 'emilys' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  @MinLength(3)
  @MaxLength(30)
  username!: string;

  @ApiProperty({ example: 'emily.johnson@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Emily' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Johnson' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ enum: UserGender, example: UserGender.FEMALE })
  @IsEnum(UserGender)
  gender!: UserGender;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;
}
