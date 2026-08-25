import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { AdminStaffFormPageComponent } from './admin-staff-form-page.component';

describe('AdminStaffFormPageComponent', () => {
  let fixture: ComponentFixture<AdminStaffFormPageComponent>;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';

  async function createFixture(staffIdParam: string | null) {
    await TestBed.configureTestingModule({
      imports: [AdminStaffFormPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(staffIdParam ? { staffId: staffIdParam } : {}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffFormPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows a link to the availability page only in edit mode', async () => {
    await createFixture(staffId);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/staff/${staffId}`).flush({
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
    });
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
});
