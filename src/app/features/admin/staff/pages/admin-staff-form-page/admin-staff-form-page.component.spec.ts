import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Provider } from '@angular/core';

import { environment } from '../../../../../../environments/environment';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffFormPageComponent } from './admin-staff-form-page.component';

describe('AdminStaffFormPageComponent', () => {
  let fixture: ComponentFixture<AdminStaffFormPageComponent>;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';

  function baseStaffView(): StaffResponse {
    return {
      staffProfileId: staffId,
      userId: '33333333-3333-3333-3333-333333333333',
      fullName: 'Juan Barbero',
      email: 'juan@example.com',
      phoneNumber: null,
      displayName: 'Juan',
      bio: null,
      defaultAppointmentDurationMinutes: 30,
      photoMediaAssetId: null,
      photoUrl: null,
      tipsQrMediaAssetId: null,
      tipsQrUrl: null,
      instagramUrl: null,
      facebookUrl: null,
      tikTokUrl: null,
      youtubeUrl: null,
      xUrl: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
  }

  async function createFixture(staffIdParam: string | null, extraProviders: Provider[] = []) {
    await TestBed.configureTestingModule({
      imports: [AdminStaffFormPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(staffIdParam ? { staffId: staffIdParam } : {}) } },
        },
        ...extraProviders,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffFormPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Component methods here `await` a mocked promise (e.g. `refreshAccessToken()` /
   * `confirmModal.confirm()`) before issuing the HTTP call. `httpMock.expectOne` called
   * synchronously right after invoking such a method won't see the request yet — a `setTimeout`
   * macrotask only fires once the microtask queue (including that awaited chain) has drained.
   */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it('shows a link to the availability page only in edit mode', async () => {
    await createFixture(staffId);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush(baseStaffView());
    await fixture.whenStable();
    fixture.detectChanges();

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="availability-link"]',
    );
    expect(link).not.toBeNull();
  });

  it('does not show the availability link in create mode', async () => {
    await createFixture(null);
    fixture.detectChanges();

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="availability-link"]',
    );
    expect(link).toBeNull();
  });

  it('does not show the media upload section in create mode', async () => {
    await createFixture(null);
    fixture.detectChanges();

    const uploadButton = fixture.nativeElement.querySelector(
      '[data-testid="photo-upload-button"]',
    );
    expect(uploadButton).toBeNull();
  });

  it('uploads a photo and reflects the returned staff record', async () => {
    const authService = { refreshAccessToken: () => Promise.resolve('fake-token') };
    await createFixture(staffId, [{ provide: AuthService, useValue: authService }]);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush(baseStaffView());
    await fixture.whenStable();
    fixture.detectChanges();

    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
    const fakeInput = { files: [file], value: '' } as unknown as HTMLInputElement;
    const uploadPromise = fixture.componentInstance.onPhotoSelected({ target: fakeInput } as unknown as Event);
    await flushMicrotasks();

    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}/photo`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...baseStaffView(), photoMediaAssetId: '44444444-4444-4444-4444-444444444444', photoUrl: 'https://cdn.example.com/photo.jpg' });

    await uploadPromise;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.staff()?.photoUrl).toBe('https://cdn.example.com/photo.jpg');
  });

  it('removes the photo after the user confirms', async () => {
    await createFixture(staffId);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush({
      ...baseStaffView(),
      photoMediaAssetId: '44444444-4444-4444-4444-444444444444',
      photoUrl: 'https://cdn.example.com/photo.jpg',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmModal = TestBed.inject(ConfirmModalService);
    const removePromise = fixture.componentInstance.removePhoto();
    confirmModal._resolve(true);
    await flushMicrotasks();

    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}/photo`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ...baseStaffView(), photoMediaAssetId: null, photoUrl: null });

    await removePromise;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.staff()?.photoUrl).toBeNull();
  });

  it('preserves the existing photo and QR asset ids when saving unrelated field changes', async () => {
    await createFixture(staffId);
    fixture.detectChanges();

    const photoMediaAssetId = '55555555-5555-5555-5555-555555555555';
    const tipsQrMediaAssetId = '66666666-6666-6666-6666-666666666666';
    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush({
      ...baseStaffView(),
      photoMediaAssetId,
      photoUrl: 'https://cdn.example.com/photo.jpg',
      tipsQrMediaAssetId,
      tipsQrUrl: 'https://cdn.example.com/qr.png',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const submitPromise = fixture.componentInstance.submit();
    await flushMicrotasks();

    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.photoMediaAssetId).toBe(photoMediaAssetId);
    expect(req.request.body.tipsQrMediaAssetId).toBe(tipsQrMediaAssetId);
    req.flush({
      ...baseStaffView(),
      photoMediaAssetId,
      photoUrl: 'https://cdn.example.com/photo.jpg',
      tipsQrMediaAssetId,
      tipsQrUrl: 'https://cdn.example.com/qr.png',
    });

    await submitPromise;
    await fixture.whenStable();
    fixture.detectChanges();
  });
});
