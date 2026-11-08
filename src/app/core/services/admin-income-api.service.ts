import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  IncomeEntriesPage,
  IncomeEntryCreateRequest,
  IncomeEntryUpdateRequest,
  IncomeEntryView,
  IncomeListQuery,
} from '../models/income.models';
import { toHttpParams } from '../utils/list-query.utils';

@Injectable({
  providedIn: 'root',
})
export class AdminIncomeApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(query: IncomeListQuery = {}) {
    const params = toHttpParams({
      from: query.from,
      to: query.to,
      staffProfileId: query.staffProfileId,
      kind: query.kind,
      generalServiceId: query.generalServiceId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<IncomeEntriesPage>(this.buildUrl('/admin/income'), { params });
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
