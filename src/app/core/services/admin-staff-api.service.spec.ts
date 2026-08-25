import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminStaffApiService } from './admin-staff-api.service';

describe('AdminStaffApiService', () => {
  let service: AdminStaffApiService;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';
  const base = `${environment.defaultApiBaseUrl}/admin/staff/${staffId}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminStaffApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uploadPhoto POSTs the raw file with upload headers to /photo', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
    service.uploadPhoto(staffId, file).subscribe();

    const req = httpMock.expectOne(`${base}/photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Upload-File-Name')).toBe('photo.jpg');
    expect(req.request.headers.get('X-Upload-File-Type')).toBe('image/jpeg');
    req.flush({});
  });

  it('removePhoto DELETEs /photo', () => {
    service.removePhoto(staffId).subscribe();
    const req = httpMock.expectOne(`${base}/photo`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('uploadTipsQr POSTs the raw file with upload headers to /tips-qr', () => {
    const file = new File([new Uint8Array([1])], 'qr.png', { type: 'image/png' });
    service.uploadTipsQr(staffId, file).subscribe();

    const req = httpMock.expectOne(`${base}/tips-qr`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Upload-File-Name')).toBe('qr.png');
    req.flush({});
  });

  it('removeTipsQr DELETEs /tips-qr', () => {
    service.removeTipsQr(staffId).subscribe();
    const req = httpMock.expectOne(`${base}/tips-qr`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
