import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { StaffSelfProfileResponse } from '../../../../../core/models/staff.models';
import { StaffProfilePageComponent } from './staff-profile-page.component';

describe('StaffProfilePageComponent', () => {
  let fixture: ComponentFixture<StaffProfilePageComponent>;
  let httpMock: HttpTestingController;
  const profileUrl = `${environment.defaultApiBaseUrl}/staff/profile`;

  function baseProfile(): StaffSelfProfileResponse {
    return {
      staffProfileId: '11111111-1111-1111-1111-111111111111',
      userId: '33333333-3333-3333-3333-333333333333',
      fullName: 'Juan Barbero',
      email: 'juan@example.com',
      phoneNumber: null,
      displayName: 'Juan',
      bio: 'Bio original',
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffProfilePageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffProfilePageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('preserves the existing photo and tips-QR asset ids when saving unrelated field changes', async () => {
    fixture.detectChanges();
    httpMock.expectOne(profileUrl).flush(baseProfile());
    await fixture.whenStable();

    fixture.componentInstance.profileForm.controls.displayName.setValue('Juan Actualizado');
    const submitPromise = fixture.componentInstance.submit();

    const req = httpMock.expectOne(profileUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.photoMediaAssetId).toBe(baseProfile().photoMediaAssetId);
    expect(req.request.body.tipsQrMediaAssetId).toBe(baseProfile().tipsQrMediaAssetId);
    req.flush({ ...baseProfile(), displayName: 'Juan Actualizado' });

    await submitPromise;
  });
});
