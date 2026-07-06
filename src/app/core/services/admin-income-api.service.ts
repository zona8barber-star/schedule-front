import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  IncomeEntryCreateRequest,
  IncomeEntryUpdateRequest,
  IncomeEntryView,
} from '../models/income.models';

@Injectable({
  providedIn: 'root',
})
export class AdminIncomeApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(date: string, staffProfileId?: string | null) {
    let params = new HttpParams().set('date', date);
    if (staffProfileId) {
      params = params.set('staffProfileId', staffProfileId);
    }
    return this.httpClient.get<IncomeEntryView[]>(this.buildUrl('/admin/income'), { params });
  }

  create(request: IncomeEntryCreateRequest) {
    return this.httpClient.post<IncomeEntryView>(this.buildUrl('/admin/income'), request);
  }

  update(incomeEntryId: string, request: IncomeEntryUpdateRequest) {
    return this.httpClient.put<IncomeEntryView>(
      this.buildUrl(`/admin/income/${incomeEntryId}`),
      request,
    );
  }

  remove(incomeEntryId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/income/${incomeEntryId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
