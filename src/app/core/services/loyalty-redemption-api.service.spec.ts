import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoyaltyRedemptionApiService } from './loyalty-redemption-api.service';

describe('LoyaltyRedemptionApiService', () => {
  let service: LoyaltyRedemptionApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LoyaltyRedemptionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends the customer request with its idempotency key and cancels its own redemption', async () => {
    const requesting = firstValueFrom(service.request('r-1', 'key-1'));
    const request = httpMock.expectOne(`${api}/customer/loyalty/redemptions`);
    expect(request.request.body).toEqual({ rewardId: 'r-1', idempotencyKey: 'key-1' });
    request.flush({});
    await requesting;

    const mine = firstValueFrom(service.getMyRedemptions({ page: 9, pageSize: 25 }));
    httpMock
      .expectOne(`${api}/customer/loyalty/redemptions?page=9&pageSize=25`)
      .flush({ items: [], page: 9, pageSize: 25, totalCount: 201 });
    expect((await mine).totalCount).toBe(201);

    const deliveries = firstValueFrom(service.getDeliveries({ page: 2 }));
    httpMock.expectOne(`${api}/admin/loyalty/redemptions/deliveries?page=2`).flush({ items: [], page: 2, pageSize: 25, totalCount: 30 });
    await deliveries;

    const changes = firstValueFrom(service.getRewardChanges('r-1', { page: 3, pageSize: 10 }));
    httpMock.expectOne(`${api}/admin/loyalty/rewards/r-1/changes?page=3&pageSize=10`).flush({ items: [], page: 3, pageSize: 10, totalCount: 21 });
    await changes;

    const cancelling = firstValueFrom(service.cancelMine('d-1', null));
    httpMock.expectOne(`${api}/customer/loyalty/redemptions/d-1/cancel`).flush({});
    await cancelling;
  });

  it('filters the admin inbox and posts decisions with the version', async () => {
    const listing = firstValueFrom(
      service.getRedemptions({ status: 'Requested', customerId: 'c-1', from: '2026-11-01', to: '2026-11-06', page: 2, pageSize: 20 }),
    );
    httpMock
      .expectOne(`${api}/admin/loyalty/redemptions?status=Requested&customerId=c-1&from=2026-11-01&to=2026-11-06&page=2&pageSize=20`)
      .flush({ items: [], page: 2, pageSize: 20, totalCount: 0 });
    await listing;

    const cancelling = firstValueFrom(service.cancel('d-1', 7, 'Cliente lo pidió'));
    const request = httpMock.expectOne(`${api}/admin/loyalty/redemptions/d-1/cancel`);
    expect(request.request.body).toEqual({ version: 7, reason: 'Cliente lo pidió' });
    request.flush({});
    await cancelling;

    const counter = firstValueFrom(
      service.createAtCounter('c-1', { rewardId: 'r-1', inPersonVerified: true, approveNow: true, idempotencyKey: 'k' }),
    );
    httpMock.expectOne(`${api}/admin/loyalty/redemptions/customers/c-1`).flush({});
    await counter;
  });
});
