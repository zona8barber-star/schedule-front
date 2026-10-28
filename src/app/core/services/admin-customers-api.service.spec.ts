import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminCustomersApiService } from './admin-customers-api.service';

describe('AdminCustomersApiService', () => {
  let service: AdminCustomersApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminCustomersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('search without a query calls GET on the base URL', () => {
    service.search().subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('search sends the trimmed query as q', () => {
    service.search('  carlos ').subscribe();
    const req = httpMock.expectOne(`${base}?q=carlos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('findDuplicates sends email, phone and the excluded id', () => {
    service.findDuplicates('a@example.com', '3001234567', 'c-1').subscribe();
    const req = httpMock.expectOne(
      (request) =>
        request.url === `${base}/duplicates` &&
        request.params.get('email') === 'a@example.com' &&
        request.params.get('phone') === '3001234567' &&
        request.params.get('excludeCustomerId') === 'c-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create and update call POST and PUT with the body', () => {
    const body = { fullName: 'Carlos', phone: '3001234567', email: 'c@example.com' };

    service.create(body).subscribe();
    const createReq = httpMock.expectOne(base);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(body);
    createReq.flush({});

    service.update('c-1', body).subscribe();
    const updateReq = httpMock.expectOne(`${base}/c-1`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({});
  });

  it('linkAccount and unlinkAccount POST to their sub-resources', () => {
    service.linkAccount('c-1', { userId: 'u-1', identityVerified: true }).subscribe();
    const linkReq = httpMock.expectOne(`${base}/c-1/link-account`);
    expect(linkReq.request.method).toBe('POST');
    expect(linkReq.request.body).toEqual({ userId: 'u-1', identityVerified: true });
    linkReq.flush({});

    service.unlinkAccount('c-1', { reason: 'Error' }).subscribe();
    const unlinkReq = httpMock.expectOne(`${base}/c-1/unlink-account`);
    expect(unlinkReq.request.method).toBe('POST');
    expect(unlinkReq.request.body).toEqual({ reason: 'Error' });
    unlinkReq.flush({});
  });

  it('getMergePreview and merge target the surviving customer', () => {
    service.getMergePreview('c-1', 'c-2').subscribe();
    const previewReq = httpMock.expectOne(`${base}/c-1/merge-preview?sourceCustomerId=c-2`);
    expect(previewReq.request.method).toBe('GET');
    previewReq.flush({});

    service.merge('c-1', { sourceCustomerId: 'c-2' }).subscribe();
    const mergeReq = httpMock.expectOne(`${base}/c-1/merge`);
    expect(mergeReq.request.method).toBe('POST');
    expect(mergeReq.request.body).toEqual({ sourceCustomerId: 'c-2' });
    mergeReq.flush({});
  });

  it('createFromAccount calls POST on from-account with the body', () => {
    const body = { userId: 'u-1', phone: null, identityVerified: true };
    service.createFromAccount(body).subscribe();
    const req = httpMock.expectOne(`${base}/from-account`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('findDuplicates can exclude the source account', () => {
    service.findDuplicates('a@example.com', '', null, 'u-1').subscribe();
    const req = httpMock.expectOne(
      (request) => request.url === `${base}/duplicates` && request.params.get('excludeUserId') === 'u-1',
    );
    req.flush([]);
  });

  it('getAccountCandidates calls GET on account-candidates', () => {
    service.getAccountCandidates('ana').subscribe();
    const req = httpMock.expectOne(`${base}/account-candidates?q=ana`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
