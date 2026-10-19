import { ApiProperty } from '@nestjs/swagger';
import { UserGender, UserRole } from '../../common/enums/auth.enum.js';

export class LatestSelectedAddressDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a91' })
  id!: string;

  @ApiProperty({
    example: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  })
  formattedAddress!: string;
}

export class BusinessAddressSummaryDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a91' })
  id!: string;

  @ApiProperty({
    example: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  })
  formattedAddress!: string;
}

export class BusinessSummaryDto {
  @ApiProperty({ example: '65cb7f4a2d8b4c001f3e7a92' })
  id!: string;

  @ApiProperty({ example: 'Rahul Fresh Store' })
  businessName!: string;

  @ApiProperty({ type: [BusinessAddressSummaryDto] })
  addresses!: BusinessAddressSummaryDto[];
}

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

  @ApiProperty({ example: true })
  sellerEnabled!: boolean;

  @ApiProperty({ type: [BusinessSummaryDto] })
  businesses!: BusinessSummaryDto[];

  @ApiProperty({
    type: LatestSelectedAddressDto,
    nullable: true,
  })
  latestSelectedAddress!: LatestSelectedAddressDto | null;
}

export class AuthResponseDto extends AuthUserResponseDto {
  @ApiProperty({ description: 'Short-lived access JWT' })
  accessToken!: string;

  @ApiProperty({ description: 'Rotating refresh JWT' })
  refreshToken!: string;
}
