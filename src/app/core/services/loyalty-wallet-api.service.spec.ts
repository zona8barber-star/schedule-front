import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { LoyaltyWalletApiService } from './loyalty-wallet-api.service';

describe('LoyaltyWalletApiService', () => {
  let service: LoyaltyWalletApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LoyaltyWalletApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reads the customer own points from the customer route', () => {
    service.getMine().subscribe();
    expect(httpMock.expectOne(`${api}/customer/loyalty`).request.method).toBe('GET');
  });

  it('reads the paginated movement history of a customer and of the signed-in customer', () => {
    service.getCustomerMovements('c-1', { type: 'Accrual', from: '2026-11-01', page: 3 }).subscribe();
    const admin = httpMock.expectOne((request) => request.url === `${api}/admin/customers/c-1/loyalty/movements`);
    expect(admin.request.params.get('type')).toBe('Accrual');
    expect(admin.request.params.get('from')).toBe('2026-11-01');
    expect(admin.request.params.has('to')).toBe(false);
    expect(admin.request.params.get('page')).toBe('3');
    admin.flush({ items: [], page: 3, pageSize: 20, totalCount: 0 });

    service.getMyMovements().subscribe();
    const mine = httpMock.expectOne(`${api}/customer/loyalty/movements`);
    expect(mine.request.params.keys()).toEqual([]);
    mine.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });
  });

  it('reads a wallet and posts adjustments with their idempotency key on the admin routes', () => {
    service.getCustomerWallet('c-1').subscribe();
    httpMock.expectOne(`${api}/admin/customers/c-1/loyalty`).flush({});

    service.adjust('c-1', { direction: 'Debit', points: 5, reason: 'Corrección', idempotencyKey: 'k-1' }).subscribe();
    const request = httpMock.expectOne(`${api}/admin/customers/c-1/loyalty/adjustments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ direction: 'Debit', points: 5, reason: 'Corrección', idempotencyKey: 'k-1' });
  });
});
