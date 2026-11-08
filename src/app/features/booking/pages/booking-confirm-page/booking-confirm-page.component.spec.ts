import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentResponse } from '../../../../core/models/appointment.models';
import { PublicStaffProfileResponse } from '../../../../core/models/content.models';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { BookingConfirmPageComponent } from './booking-confirm-page.component';

describe('BookingConfirmPageComponent', () => {
  let fixture: ComponentFixture<BookingConfirmPageComponent>;
  let component: BookingConfirmPageComponent;
  let create: ReturnType<typeof vi.fn>;

  const profile: PublicStaffProfileResponse = {
    staffProfileId: 'st-1',
    displayName: 'Alex',
    bio: null,
    phoneNumber: null,
    photoMediaAssetId: null,
    photoUrl: null,
    tipsQrMediaAssetId: null,
    tipsQrUrl: null,
    defaultAppointmentDurationMinutes: 30,
    averageRating: 0,
    reviewCount: 0,
    services: [
      {
        generalServiceId: 'g-beard',
        name: 'Barba',
        description: null,
        categoryId: 'c-barber',
        categoryName: 'Barbería',
        durationMinutes: 20,
      },
    ],
    instagramUrl: null,
    facebookUrl: null,
    tikTokUrl: null,
    youtubeUrl: null,
    xUrl: null,
  };

  const appointment: AppointmentResponse = {
    id: 'a-1',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: 'u-1',
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    startsAtUtc: '2026-11-07T15:00:00Z',
    endsAtUtc: '2026-11-07T15:20:00Z',
    status: 'Pending',
    source: 'CustomerBooking',
    notes: null,
    generalServiceId: 'g-beard',
    generalServiceName: 'Barba',
    reservedDurationMinutes: 20,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };

  async function open(queryParams: Record<string, string>): Promise<void> {
    create = vi.fn(() => of(appointment));
    await TestBed.configureTestingModule({
      imports: [BookingConfirmPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        { provide: PublicStaffApiService, useValue: { getById: () => of(profile) } },
        { provide: CustomerAppointmentsApiService, useValue: { create } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingConfirmPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  const fullParams = { staffProfileId: 'st-1', startsAt: '2026-11-07T15:00:00Z', generalServiceId: 'g-beard' };

  it('shows the professional, the time, the service and its duration, without a price', async () => {
    await open(fullParams);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Alex');
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-service"]').textContent.trim()).toBe('Barba');
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-duration"]').textContent.trim()).toBe('20 min');
    expect(text).not.toContain('$');
  });

  it('books the chosen service', async () => {
    await open(fullParams);

    await component.confirmBooking();

    expect(create).toHaveBeenCalledWith({
      staffProfileId: 'st-1',
      generalServiceId: 'g-beard',
      startsAtUtc: '2026-11-07T15:00:00Z',
      notes: null,
    });
    expect(component.successAppointment()?.id).toBe('a-1');
  });

  it('goes back to the same day and service with "Cambiar fecha u hora"', async () => {
    await open(fullParams);

    expect(component.changeDateQueryParams()).toEqual({ reservar: 1, fecha: '2026-11-07', servicio: 'g-beard' });
  });

  it('does not book without a service', async () => {
    await open({ staffProfileId: 'st-1', startsAt: '2026-11-07T15:00:00Z' });

    expect(component.canSubmit()).toBe(false);
    await component.confirmBooking();
    expect(create).not.toHaveBeenCalled();
  });
});
