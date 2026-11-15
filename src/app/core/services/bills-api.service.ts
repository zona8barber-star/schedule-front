import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  BillApprovalPreviewView,
  BillCustomerOption,
  BillEventView,
  BillLineRequest,
  BillListQuery,
  BillMembershipOption,
  BillOpenRequest,
  BillOptionsView,
  BillPendingView,
  BillRedemptionOption,
  BillSummaryView,
  BillView,
  PaymentMethodView,
} from '../models/bill.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/**
 * Bills (ADR-0020). Every action checks its own permission again in the API (open, close, charge, discount, manage);
 * approving and voiding are critical and verified against the database on every request.
 */
@Injectable({
  providedIn: 'root',
})
export class BillsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  options() {
    return this.httpClient.get<BillOptionsView>(this.buildUrl('/bills/options'));
  }

  list(query: BillListQuery = {}) {
    const params = toHttpParams({
      status: query.status,
      staffProfileId: query.staffProfileId,
      from: query.from,
      to: query.to,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<BillSummaryView>>(this.buildUrl('/bills'), { params });
  }

  pending() {
    return this.httpClient.get<BillPendingView>(this.buildUrl('/bills/pending'));
  }

  pendingCount() {
    return this.httpClient.get<{ count: number }>(this.buildUrl('/bills/pending/count'));
  }

  searchCustomers(q: string) {
    return this.httpClient.get<BillCustomerOption[]>(this.buildUrl('/bills/customers'), { params: toHttpParams({ q }) });
  }

  get(billId: string) {
    return this.httpClient.get<BillView>(this.buildUrl(`/bills/${billId}`));
  }

  events(billId: string) {
    return this.httpClient.get<BillEventView[]>(this.buildUrl(`/bills/${billId}/events`));
  }

  membershipOptions(billId: string) {
    return this.httpClient.get<BillMembershipOption[]>(this.buildUrl(`/bills/${billId}/membership-options`));
  }

  redemptionOptions(billId: string) {
    return this.httpClient.get<BillRedemptionOption[]>(this.buildUrl(`/bills/${billId}/redemption-options`));
  }

  open(request: BillOpenRequest) {
    return this.httpClient.post<BillView>(this.buildUrl('/bills'), request);
  }

  updateHeader(
    billId: string,
    request: { version: number; customerId: string | null; customerName: string | null; serviceDate: string | null; notes: string | null },
  ) {
    return this.httpClient.put<BillView>(this.buildUrl(`/bills/${billId}`), request);
  }

  addLine(billId: string, request: BillLineRequest) {
    return this.httpClient.post<BillView>(this.buildUrl(`/bills/${billId}/lines`), request);
  }

  updateLine(billId: string, lineId: string, request: BillLineRequest) {
    return this.httpClient.put<BillView>(this.buildUrl(`/bills/${billId}/lines/${lineId}`), request);
  }

  removeLine(billId: string, lineId: string, version: number) {
    return this.httpClient.delete<BillView>(this.buildUrl(`/bills/${billId}/lines/${lineId}`), {
      params: toHttpParams({ version }),
    });
  }

  close(billId: string, version: number, paymentMethodId: string | null) {
    return this.httpClient.post<BillView>(this.buildUrl(`/bills/${billId}/close`), { version, paymentMethodId });
  }

  detachAppointment(billId: string, version: number, reason: string) {
    return this.httpClient.post<BillView>(this.buildUrl(`/bills/${billId}/detach-appointment`), { version, reason });
  }

  void(billId: string, version: number, reason: string) {
    return this.httpClient.post<BillView>(this.buildUrl(`/bills/${billId}/void`), { version, reason });
  }

  changePaymentMethod(billId: string, version: number, paymentMethodId: string) {
    return this.httpClient.put<BillView>(this.buildUrl(`/bills/${billId}/payment-method`), { version, paymentMethodId });
  }

  approvalPreview(billId: string) {
    return this.httpClient.get<BillApprovalPreviewView>(this.buildUrl(`/bills/${billId}/approval-preview`));
  }

  approve(billId: string, request: { version: number; idempotencyKey: string; noPointsLineIds: string[]; notes: string | null }) {
    return this.httpClient.post<BillView>(this.buildUrl(`/bills/${billId}/approve`), request);
  }

  paymentMethods() {
    return this.httpClient.get<PaymentMethodView[]>(this.buildUrl('/admin/payment-methods'));
  }

  createPaymentMethod(request: { name: string; sortOrder: number | null; isActive: boolean }) {
    return this.httpClient.post<PaymentMethodView>(this.buildUrl('/admin/payment-methods'), request);
  }

  updatePaymentMethod(paymentMethodId: string, request: { name: string; sortOrder: number | null; isActive: boolean }) {
    return this.httpClient.put<PaymentMethodView>(this.buildUrl(`/admin/payment-methods/${paymentMethodId}`), request);
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
