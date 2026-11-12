import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AppointmentResponse } from '../../../../core/models/appointment.models';
import { PublicStaffProfileResponse } from '../../../../core/models/content.models';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { BookingConfirmPageComponent } from './booking-confirm-page.component';

@Component({ template: '' })
class StubPageComponent {}

describe('BookingConfirmPageComponent', () => {
  let fixture: ComponentFixture<BookingConfirmPageComponent>;
  let component: BookingConfirmPageComponent;
  let create: ReturnType<typeof vi.fn>;
  let getById: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;

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

  async function open(
    queryParams: Record<string, string>,
    api: { create?: ReturnType<typeof vi.fn>; list?: ReturnType<typeof vi.fn> } = {},
  ): Promise<void> {
    create = api.create ?? vi.fn(() => of(appointment));
    getById = vi.fn(() => of(appointment));
    list = api.list ?? vi.fn(() => of({ items: [], page: 1, pageSize: 100, totalCount: 0 }));
    await TestBed.configureTestingModule({
      imports: [BookingConfirmPageComponent],
      providers: [
        provideRouter([{ path: 'booking/confirm', component: StubPageComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        { provide: PublicStaffApiService, useValue: { getById: () => of(profile) } },
        { provide: CustomerAppointmentsApiService, useValue: { create, getById, list } },
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

  // SONDA BUG-043: reloading (F5) or coming back after booking must not offer to book the same slot again.
  describe('after booking', () => {
    const confirmButton = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Confirmar reserva'),
      );

    it('replaces the URL with one that points to the booking', async () => {
      await open(fullParams);

      await component.confirmBooking();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(TestBed.inject(Router).url).toBe('/booking/confirm?appointmentId=a-1');
    });

    it('shows the booking when the page is opened again with that URL, without offering to confirm', async () => {
      await open({ appointmentId: 'a-1' });

      expect(getById).toHaveBeenCalledWith('a-1');
      expect(create).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Tu cita fue creada correctamente');
      expect(fixture.nativeElement.textContent).not.toContain('Faltan datos para reservar');
      expect(confirmButton()).toBeUndefined();
    });

    it('shows the booking, not "no disponible", when the customer already holds that very slot', async () => {
      await open(fullParams, {
        create: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409 }))),
        list: vi.fn(() => of({ items: [appointment], page: 1, pageSize: 100, totalCount: 1 })),
      });

      await component.confirmBooking();
      fixture.detectChanges();

      expect(component.successAppointment()?.id).toBe('a-1');
      expect(component.errorMessage()).toBeNull();
      expect(component.slotTaken()).toBe(false);
    });

    it('still says the slot is taken when someone else took it', async () => {
      await open(fullParams, {
        create: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409 }))),
        list: vi.fn(() => of({ items: [{ ...appointment, staffProfileId: 'st-other' }], page: 1, pageSize: 100, totalCount: 1 })),
      });

      await component.confirmBooking();

      expect(component.successAppointment()).toBeNull();
      expect(component.slotTaken()).toBe(true);
      expect(component.errorMessage()).toBe('Ese horario ya no está disponible o el servicio ya no se ofrece.');
    });
  });
});
