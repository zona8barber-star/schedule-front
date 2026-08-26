import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffFormModalComponent } from './admin-staff-form-modal.component';

describe('AdminStaffFormModalComponent', () => {
  let fixture: ComponentFixture<AdminStaffFormModalComponent>;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';

  function baseStaffView(): StaffResponse {
    return {
      staffProfileId: staffId,
      userId: '33333333-3333-3333-3333-333333333333',
      fullName: 'Juan Barbero',
      email: 'juan@example.com',
      phoneNumber: '123456789',
      displayName: 'Juan',
      bio: 'Barbero con 10 anos de experiencia.',
      defaultAppointmentDurationMinutes: 30,
      photoMediaAssetId: '44444444-4444-4444-4444-444444444444',
      photoUrl: 'https://cdn.example.com/photo.jpg',
      tipsQrMediaAssetId: '55555555-5555-5555-5555-555555555555',
      tipsQrUrl: 'https://cdn.example.com/qr.png',
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

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [AdminStaffFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffFormModalComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('preserves the existing bio, photo, and tips QR asset ids when saving unrelated field changes', async () => {
    await createFixture();
    fixture.componentRef.setInput('staffId', staffId);
    fixture.detectChanges();

    const originalStaff = baseStaffView();
    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush(originalStaff);
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.staffForm.controls.phoneNumber.setValue('999888777');

    const submitPromise = fixture.componentInstance.submit();
    await fixture.whenStable();

    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.phoneNumber).toBe('999888777');
    expect(req.request.body.bio).toBe(originalStaff.bio);
    expect(req.request.body.photoMediaAssetId).toBe(originalStaff.photoMediaAssetId);
    expect(req.request.body.tipsQrMediaAssetId).toBe(originalStaff.tipsQrMediaAssetId);
    req.flush({ ...originalStaff, phoneNumber: '999888777' });

    await submitPromise;
    await fixture.whenStable();
    fixture.detectChanges();
  });
});
