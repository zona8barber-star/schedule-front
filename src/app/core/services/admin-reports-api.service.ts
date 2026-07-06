import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { ReportSummaryView } from '../models/report.models';

@Injectable({
  providedIn: 'root',
})
export class AdminReportsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getSummary(from: string, to: string) {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.httpClient.get<ReportSummaryView>(this.buildUrl('/admin/reports/summary'), {
      params,
    });
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
