import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { StaffManagementView } from '../../../../../core/models/staff.models';
import { AdminStaffAvailabilityPageComponent } from './admin-staff-availability-page.component';

describe('AdminStaffAvailabilityPageComponent', () => {
  let fixture: ComponentFixture<AdminStaffAvailabilityPageComponent>;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';
  const availabilityBase = `${environment.defaultApiBaseUrl}/admin/staff/${staffId}/availability`;
  const staffUrl = `${environment.defaultApiBaseUrl}/admin/staff/${staffId}`;

  const staffView: StaffManagementView = {
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStaffAvailabilityPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ staffId }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStaffAvailabilityPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the staff name, summary and unavailable periods for the given staffId', () => {
    fixture.detectChanges();

    httpMock.expectOne(staffUrl).flush(staffView);
    httpMock.expectOne(availabilityBase).flush({
      staffProfileId: staffId,
      defaultAppointmentDurationMinutes: 30,
      rules: [{ id: 'r1', dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00', isActive: true }],
      unavailablePeriods: [],
    });
    httpMock.expectOne(`${availabilityBase}/unavailable-periods`).flush([]);

    expect(fixture.componentInstance.staffName()).toBe('Juan');
    expect(fixture.componentInstance.summary()?.rules.length).toBe(1);
  });

  it('shows a page error when the staff profile cannot be loaded', () => {
    fixture.detectChanges();

    httpMock.expectOne(staffUrl).flush('not found', { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(availabilityBase).flush('not found', { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${availabilityBase}/unavailable-periods`).flush([]);

    expect(fixture.componentInstance.pageErrorMessage()).toBeTruthy();
    expect(fixture.componentInstance.summary()).toBeNull();
  });

  it('saveRules sends only active days as PUT /rules', async () => {
    fixture.detectChanges();
    httpMock.expectOne(staffUrl).flush(staffView);
    httpMock.expectOne(availabilityBase).flush({
      staffProfileId: staffId,
      defaultAppointmentDurationMinutes: 30,
      rules: [],
      unavailablePeriods: [],
    });
    httpMock.expectOne(`${availabilityBase}/unavailable-periods`).flush([]);

    fixture.componentInstance.daysArray.at(1).controls.isActive.setValue(true);
    const savePromise = fixture.componentInstance.saveRules();

    const req = httpMock.expectOne(`${availabilityBase}/rules`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual([
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
    ]);
    req.flush([{ id: 'r1', dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00', isActive: true }]);

    await savePromise;
    expect(fixture.componentInstance.rulesSuccessMessage()).toBeTruthy();
  });
});
