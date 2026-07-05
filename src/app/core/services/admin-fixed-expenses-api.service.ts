import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  FixedExpenseCreateRequest,
  FixedExpenseStatusUpdateRequest,
  FixedExpenseUpdateRequest,
  FixedExpenseView,
} from '../models/fixed-expense.models';

@Injectable({
  providedIn: 'root',
})
export class AdminFixedExpensesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<FixedExpenseView[]>(this.buildUrl('/admin/fixed-expenses'));
  }

  getById(fixedExpenseId: string) {
    return this.httpClient.get<FixedExpenseView>(this.buildUrl(`/admin/fixed-expenses/${fixedExpenseId}`));
  }

  create(request: FixedExpenseCreateRequest) {
    return this.httpClient.post<FixedExpenseView>(this.buildUrl('/admin/fixed-expenses'), request);
  }

  update(fixedExpenseId: string, request: FixedExpenseUpdateRequest) {
    return this.httpClient.put<FixedExpenseView>(
      this.buildUrl(`/admin/fixed-expenses/${fixedExpenseId}`),
      request,
    );
  }

  updateStatus(fixedExpenseId: string, request: FixedExpenseStatusUpdateRequest) {
    return this.httpClient.patch<FixedExpenseView>(
      this.buildUrl(`/admin/fixed-expenses/${fixedExpenseId}/status`),
      request,
    );
  }

  remove(fixedExpenseId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/fixed-expenses/${fixedExpenseId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
