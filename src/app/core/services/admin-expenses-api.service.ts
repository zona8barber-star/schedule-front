import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ExpenseEntryCreateRequest,
  ExpenseEntryUpdateRequest,
  ExpenseEntryView,
} from '../models/expense.models';

@Injectable({
  providedIn: 'root',
})
export class AdminExpensesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(year: number, month: number) {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.httpClient.get<ExpenseEntryView[]>(this.buildUrl('/admin/expenses'), { params });
  }

  create(request: ExpenseEntryCreateRequest) {
    return this.httpClient.post<ExpenseEntryView>(this.buildUrl('/admin/expenses'), request);
  }

  update(expenseEntryId: string, request: ExpenseEntryUpdateRequest) {
    return this.httpClient.put<ExpenseEntryView>(
      this.buildUrl(`/admin/expenses/${expenseEntryId}`),
      request,
    );
  }

  remove(expenseEntryId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/expenses/${expenseEntryId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
