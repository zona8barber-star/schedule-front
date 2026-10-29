import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CustomerMembershipDetailView,
  CustomerMembershipSummaryView,
  MembershipActivateRequest,
  MembershipAnnulRequest,
  MembershipConsumptionRequest,
  MembershipConsumptionReverseRequest,
  MembershipGiftDeliveryRequest,
  MembershipGiftDeliveryReverseRequest,
  MembershipIncomeCandidateView,
  MembershipIncomeLinkRequest,
  MembershipIncomeUnlinkRequest,
  MembershipSaleRequest,
} from '../models/membership.models';

@Injectable({
  providedIn: 'root',
})
export class AdminMembershipsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  listForCustomer(customerId: string) {
    return this.httpClient.get<CustomerMembershipSummaryView[]>(
      this.buildUrl(`/admin/customers/${customerId}/memberships`),
    );
  }

  sell(customerId: string, request: MembershipSaleRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/customers/${customerId}/memberships`),
      request,
    );
  }

  getById(membershipId: string) {
    return this.httpClient.get<CustomerMembershipDetailView>(this.buildUrl(`/admin/memberships/${membershipId}`));
  }

  activate(membershipId: string, request: MembershipActivateRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/activate`),
      request,
    );
  }

  annul(membershipId: string, request: MembershipAnnulRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/annul`),
      request,
    );
  }

  incomeCandidates(date: string) {
    return this.httpClient.get<MembershipIncomeCandidateView[]>(this.buildUrl('/admin/memberships/income-candidates'), {
      params: new HttpParams().set('date', date),
    });
  }

  linkIncome(membershipId: string, request: MembershipIncomeLinkRequest) {
    return this.httpClient.put<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/income-link`),
      request,
    );
  }

  unlinkIncome(membershipId: string, request: MembershipIncomeUnlinkRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/income-unlink`),
      request,
    );
  }

  consume(membershipId: string, request: MembershipConsumptionRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/consumptions`),
      request,
    );
  }

  reverseConsumption(membershipId: string, consumptionId: string, request: MembershipConsumptionReverseRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/consumptions/${consumptionId}/reverse`),
      request,
    );
  }

  deliverGift(membershipId: string, giftId: string, request: MembershipGiftDeliveryRequest) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/gifts/${giftId}/deliveries`),
      request,
    );
  }

  reverseGiftDelivery(
    membershipId: string,
    giftId: string,
    deliveryId: string,
    request: MembershipGiftDeliveryReverseRequest,
  ) {
    return this.httpClient.post<CustomerMembershipDetailView>(
      this.buildUrl(`/admin/memberships/${membershipId}/gifts/${giftId}/deliveries/${deliveryId}/reverse`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
