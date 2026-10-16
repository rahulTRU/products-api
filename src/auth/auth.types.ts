import { UserGender, UserRole } from '../common/enums/auth.enum.js';

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  role: UserRole;
  image: string;
}

export interface AuthResponse extends AuthUserResponse {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}
