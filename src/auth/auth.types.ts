import { UserGender, UserRole } from '../common/enums/auth.enum.js';

export interface BusinessSummary {
  id: string;
  businessName: string;
  addresses: {
    id: string;
    formattedAddress: string;
  }[];
}

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  role: UserRole;
  image: string;
  sellerEnabled: boolean;
  businesses: BusinessSummary[];
  latestSelectedAddress: {
    id: string;
    formattedAddress: string;
  } | null;
}

export interface AuthResponse extends AuthUserResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPrincipal {
  id: string;
  role: UserRole;
  sellerEnabled?: boolean;
}

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  role?: UserRole;
  sellerEnabled?: boolean;
}
