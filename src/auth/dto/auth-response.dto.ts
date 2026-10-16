import { ApiProperty } from '@nestjs/swagger';
import { UserGender, UserRole } from '../../common/enums/auth.enum.js';

export class AuthUserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string;

  @ApiProperty({ example: 'emilys' })
  username!: string;

  @ApiProperty({ example: 'emily.johnson@example.com' })
  email!: string;

  @ApiProperty({ example: 'Emily' })
  firstName!: string;

  @ApiProperty({ example: 'Johnson' })
  lastName!: string;

  @ApiProperty({ enum: UserGender, example: UserGender.FEMALE })
  gender!: UserGender;

  @ApiProperty({ enum: UserRole, example: UserRole.BUYER })
  role!: UserRole;

  @ApiProperty({ example: 'https://example.com/avatar.png' })
  image!: string;
}

export class AuthResponseDto extends AuthUserResponseDto {
  @ApiProperty({ description: 'Short-lived access JWT' })
  accessToken!: string;

  @ApiProperty({ description: 'Rotating refresh JWT' })
  refreshToken!: string;
}
