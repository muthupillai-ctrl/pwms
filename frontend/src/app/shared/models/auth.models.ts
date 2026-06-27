export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  currency: string;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  mfaRequired: boolean;
  loading: boolean;
  error: string | null;
}

export type UserRole = 'owner' | 'admin' | 'loan_user';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account_count?: number;
  transaction_count?: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  newToday: number;
  newThisWeek: number;
  mfaEnabled: number;
  byRole: Record<string, number>;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AdminPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SystemCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_system: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  iat: number;
  exp: number;
}
