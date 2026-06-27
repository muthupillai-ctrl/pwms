import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, JwtPayload, LoginRequest, RegisterRequest, User, UserRole } from '../../shared/models/auth.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly KEYS = {
    access:  'pwms_access_token',
    refresh: 'pwms_refresh_token',
    name:    'pwms_user_name',
  };

  constructor(private http: HttpClient) {}

  // ── API calls ────────────────────────────────────────────
  register(payload: RegisterRequest): Observable<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    return this.http.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(`${this.base}/register`, payload).pipe(
      tap((res) => {
        this.storeTokens(res.data.tokens);
        this.storeName((res.data.user as any).full_name ?? (res.data.user as any).fullName ?? '');
      })
    );
  }

  initiateRegister(payload: RegisterRequest): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.base}/register/initiate`, payload);
  }

  verifyRegisterOtp(email: string, otp: string): Observable<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    return this.http.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(`${this.base}/register/verify`, { email, otp }).pipe(
      tap((res) => {
        this.storeTokens(res.data.tokens);
        this.storeName((res.data.user as any).full_name ?? (res.data.user as any).fullName ?? '');
      })
    );
  }

  login(payload: LoginRequest): Observable<ApiResponse<{ user: User; tokens: AuthTokens; mfaRequired: boolean }>> {
    return this.http.post<ApiResponse<{ user: User; tokens: AuthTokens; mfaRequired: boolean }>>(`${this.base}/login`, payload).pipe(
      tap((res) => {
        if (!res.data.mfaRequired) {
          this.storeTokens(res.data.tokens);
          this.storeName((res.data.user as any).full_name ?? (res.data.user as any).fullName ?? '');
        } else {
          this.setAccessToken(res.data.tokens.accessToken);
        }
      })
    );
  }

  verifyMfa(token: string): Observable<ApiResponse<AuthTokens>> {
    return this.http.post<ApiResponse<AuthTokens>>(`${this.base}/mfa/verify`, { token }).pipe(
      tap((res) => this.storeTokens(res.data))
    );
  }

  refresh(): Observable<ApiResponse<AuthTokens>> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<ApiResponse<AuthTokens>>(`${this.base}/refresh`, { refreshToken }).pipe(
      tap((res) => this.storeTokens(res.data))
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    this.clearTokens();
    return this.http.post<void>(`${this.base}/logout`, { refreshToken });
  }

  me(): Observable<ApiResponse<{ user: User }>> {
    return this.http.get<ApiResponse<{ user: User }>>(`${this.base}/me`);
  }

  setupMfa(): Observable<ApiResponse<{ otpauthUrl: string; qrCodeDataUrl: string }>> {
    return this.http.post<ApiResponse<{ otpauthUrl: string; qrCodeDataUrl: string }>>(`${this.base}/mfa/setup`, {});
  }

  confirmMfa(token: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.base}/mfa/confirm`, { token });
  }

  // ── Token helpers ────────────────────────────────────────
  storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.KEYS.access,  tokens.accessToken);
    localStorage.setItem(this.KEYS.refresh, tokens.refreshToken);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(this.KEYS.access, token);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.KEYS.access);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.KEYS.refresh);
  }

  storeName(name: string): void {
    localStorage.setItem(this.KEYS.name, name);
  }

  getName(): string {
    return localStorage.getItem(this.KEYS.name) ?? '';
  }

  clearTokens(): void {
    localStorage.removeItem(this.KEYS.access);
    localStorage.removeItem(this.KEYS.refresh);
    localStorage.removeItem(this.KEYS.name);
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now() && payload.mfaVerified === true;
    } catch {
      return false;
    }
  }

  getTokenPayload(): JwtPayload | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  getRole(): UserRole {
    return this.getTokenPayload()?.role ?? 'owner';
  }

  isLoanUser(): boolean {
    return this.getRole() === 'loan_user';
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

}
