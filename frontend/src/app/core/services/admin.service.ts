import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser, AdminStats, AuditLog, AdminPageMeta, SystemCategory, UserRole } from '../../shared/models/auth.models';

interface ApiResponse<T> { success: boolean; data: T; meta?: AdminPageMeta; }
interface PagedResponse<T> { data: T[]; meta: AdminPageMeta; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly base = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // ── Stats ──────────────────────────────────────────────────
  getStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.base}/stats`);
  }

  // ── Users ──────────────────────────────────────────────────
  listUsers(params: { page?: number; limit?: number; search?: string; role?: string; status?: string }): Observable<ApiResponse<AdminUser[]>> {
    let p = new HttpParams();
    if (params.page)   p = p.set('page',   String(params.page));
    if (params.limit)  p = p.set('limit',  String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.role)   p = p.set('role',   params.role);
    if (params.status) p = p.set('status', params.status);
    return this.http.get<ApiResponse<AdminUser[]>>(`${this.base}/users`, { params: p });
  }

  getUser(id: string): Observable<ApiResponse<AdminUser>> {
    return this.http.get<ApiResponse<AdminUser>>(`${this.base}/users/${id}`);
  }

  updateStatus(id: string, isActive: boolean): Observable<ApiResponse<AdminUser>> {
    return this.http.patch<ApiResponse<AdminUser>>(`${this.base}/users/${id}/status`, { isActive });
  }

  updateRole(id: string, role: UserRole): Observable<ApiResponse<AdminUser>> {
    return this.http.patch<ApiResponse<AdminUser>>(`${this.base}/users/${id}/role`, { role });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }

  // ── Audit Logs ─────────────────────────────────────────────
  listAuditLogs(params: { page?: number; limit?: number; userId?: string; action?: string; dateFrom?: string; dateTo?: string }): Observable<ApiResponse<AuditLog[]>> {
    let p = new HttpParams();
    if (params.page)     p = p.set('page',     String(params.page));
    if (params.limit)    p = p.set('limit',    String(params.limit));
    if (params.userId)   p = p.set('userId',   params.userId);
    if (params.action)   p = p.set('action',   params.action);
    if (params.dateFrom) p = p.set('dateFrom', params.dateFrom);
    if (params.dateTo)   p = p.set('dateTo',   params.dateTo);
    return this.http.get<ApiResponse<AuditLog[]>>(`${this.base}/audit-logs`, { params: p });
  }

  // ── Categories ─────────────────────────────────────────────
  listCategories(): Observable<ApiResponse<SystemCategory[]>> {
    return this.http.get<ApiResponse<SystemCategory[]>>(`${this.base}/categories`);
  }

  createCategory(data: { name: string; icon?: string; color?: string }): Observable<ApiResponse<SystemCategory>> {
    return this.http.post<ApiResponse<SystemCategory>>(`${this.base}/categories`, data);
  }

  updateCategory(id: string, data: { name?: string; icon?: string | null; color?: string | null }): Observable<ApiResponse<SystemCategory>> {
    return this.http.patch<ApiResponse<SystemCategory>>(`${this.base}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }
}
