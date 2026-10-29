import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminMembershipsApiService } from './admin-memberships-api.service';

describe('AdminMembershipsApiService', () => {
  let service: AdminMembershipsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminMembershipsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists and sells under the customer', () => {
    service.listForCustomer('c-1').subscribe();
    expect(httpMock.expectOne(`${api}/admin/customers/c-1/memberships`).request.method).toBe('GET');

    const sale = {
      planId: 'p-1',
      startsOn: '2026-10-28',
      endsOn: null,
      soldOn: null,
      activateNow: true,
      confirmExpiredActivation: false,
      activationReason: null,
    };
    service.sell('c-1', sale).subscribe();
    const req = httpMock.expectOne(`${api}/admin/customers/c-1/memberships`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(sale);
    req.flush({});
  });

  it('activates, annuls, links and unlinks under the membership', () => {
    service.activate('m-1', { confirmExpiredActivation: false, reason: null }).subscribe();
    expect(httpMock.expectOne(`${api}/admin/memberships/m-1/activate`).request.method).toBe('POST');

    service.annul('m-1', { reason: 'Error' }).subscribe();
    expect(httpMock.expectOne(`${api}/admin/memberships/m-1/annul`).request.body).toEqual({ reason: 'Error' });

    const link = { incomeEntryId: 'i-1', additionalMembershipIds: ['m-2'], discrepancyJustification: null };
    service.linkIncome('m-1', link).subscribe();
    const linkReq = httpMock.expectOne(`${api}/admin/memberships/m-1/income-link`);
    expect(linkReq.request.method).toBe('PUT');
    expect(linkReq.request.body).toEqual(link);

    service.unlinkIncome('m-1', { discrepancyJustification: 'x' }).subscribe();
    expect(httpMock.expectOne(`${api}/admin/memberships/m-1/income-unlink`).request.method).toBe('POST');

    const consumption = { serviceId: 's-1', quantity: 2, serviceDate: '2026-10-28', staffProfileId: null, idempotencyKey: 'k-1' };
    service.consume('m-1', consumption).subscribe();
    const consumeReq = httpMock.expectOne(`${api}/admin/memberships/m-1/consumptions`);
    expect(consumeReq.request.method).toBe('POST');
    expect(consumeReq.request.body).toEqual(consumption);

    service.reverseConsumption('m-1', 'c-1', { reason: 'Error' }).subscribe();
    const reverseReq = httpMock.expectOne(`${api}/admin/memberships/m-1/consumptions/c-1/reverse`);
    expect(reverseReq.request.method).toBe('POST');
    expect(reverseReq.request.body).toEqual({ reason: 'Error' });

    service.incomeCandidates('2026-10-28').subscribe();
    expect(httpMock.expectOne(`${api}/admin/memberships/income-candidates?date=2026-10-28`).request.method).toBe('GET');
  });
});
