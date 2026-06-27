import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PortfolioSummary } from '../../shared/models/portfolio.models';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly base = `${environment.apiUrl}/portfolio`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<PortfolioSummary> {
    return this.http
      .get<ApiResponse<{ summary: PortfolioSummary }>>(`${this.base}/summary`)
      .pipe(map((res) => res.data.summary));
  }
}
