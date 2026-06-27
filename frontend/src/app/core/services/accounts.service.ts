import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account, CreateAccountPayload, UpdateAccountPayload } from '../../shared/models/accounts.models';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly base = `${environment.apiUrl}/accounts`;

  constructor(private http: HttpClient) {}

  list(): Observable<Account[]> {
    return this.http
      .get<ApiResponse<{ accounts: Account[] }>>(this.base)
      .pipe(map((res) => res.data.accounts));
  }

  getOne(id: string): Observable<Account> {
    return this.http
      .get<ApiResponse<{ account: Account }>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data.account));
  }

  create(payload: CreateAccountPayload): Observable<Account> {
    return this.http
      .post<ApiResponse<{ account: Account }>>(this.base, payload)
      .pipe(map((res) => res.data.account));
  }

  update(id: string, payload: UpdateAccountPayload): Observable<Account> {
    return this.http
      .patch<ApiResponse<{ account: Account }>>(`${this.base}/${id}`, payload)
      .pipe(map((res) => res.data.account));
  }

  updateBalance(id: string, balance: number, notes?: string): Observable<Account> {
    return this.http
      .patch<ApiResponse<{ account: Account }>>(`${this.base}/${id}/balance`, { balance, notes })
      .pipe(map((res) => res.data.account));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
