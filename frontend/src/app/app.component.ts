import { Component, VERSION } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor(private http: HttpClient) {
    console.log('[Build]', {
      appName:       environment.appName,
      production:    environment.production,
      apiUrl:        environment.apiUrl,
      angularVersion: VERSION.full,
    });

    const healthUrl = `${environment.apiUrl.replace(/\/api\/v1\/?$/, '')}/health`;
    this.http.get(healthUrl).subscribe({
      next:  (res) => console.log('[Backend API] reachable:', healthUrl, res),
      error: (err) => console.error('[Backend API] unreachable:', healthUrl, err.message ?? err),
    });
  }
}
