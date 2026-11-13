import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AppointmentResponse } from '../../../../core/models/appointment.models';
import { PublicStaffListItemResponse } from '../../../../core/models/content.models';
import { RoleName } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { CustomerAppointmentsApiService } from '../../../../core/services/customer-appointments-api.service';
import { PublicStaffApiService } from '../../../../core/services/public-staff-api.service';
import { setDeviceTimeZone } from '../../../../testing/device-time-zone';
import { BookingLandingPageComponent } from './booking-landing-page.component';

/** SONDA BUG-024: /booking shows the customer's real next appointment and the services really offered. */
describe('BookingLandingPageComponent', () => {
  let fixture: ComponentFixture<BookingLandingPageComponent>;
  let list: ReturnType<typeof vi.fn>;
  let restoreTimeZone: () => void;

  beforeAll(() => (restoreTimeZone = setDeviceTimeZone('UTC')));
  afterAll(() => restoreTimeZone());

  const next: AppointmentResponse = {
    id: 'a-1',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: 'u-1',
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    // Tuesday Nov 10, 09:00 in Bogotá.
    startsAtUtc: '2026-11-10T14:00:00Z',
    endsAtUtc: '2026-11-10T14:30:00Z',
    status: 'Pending',
    source: 'CustomerBooking',
    notes: null,
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte clásico',
    reservedDurationMinutes: 30,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };

  const professional = (id: string, services: [string, string][]): PublicStaffListItemResponse => ({
    staffProfileId: id,
    displayName: id,
    bio: null,
    phoneNumber: null,
    photoMediaAssetId: null,
    photoUrl: null,
    defaultAppointmentDurationMinutes: 30,
    averageRating: 0,
    reviewCount: 0,
    services: services.map(([generalServiceId, name]) => ({
      generalServiceId,
      name,
      description: null,
      categoryId: 'c',
      categoryName: 'Barbería',
      durationMinutes: 30,
    })),
  });

  async function open(options: { roles?: RoleName[] | null; appointments?: AppointmentResponse[]; failAppointments?: boolean }) {
    const roles = options.roles ?? null;
    list = vi.fn(() =>
      options.failAppointments
        ? throwError(() => new Error('down'))
        : of({ items: options.appointments ?? [], page: 1, pageSize: 1, totalCount: options.appointments?.length ?? 0 }),
    );

    await TestBed.configureTestingModule({
      imports: [BookingLandingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            ensureInitialized: vi.fn(async () => undefined),
            isAuthenticated: signal(roles !== null),
            hasRole: (role: RoleName) => roles?.includes(role) ?? false,
          },
        },
        { provide: CustomerAppointmentsApiService, useValue: { list } },
        {
          provide: PublicStaffApiService,
          useValue: {
            list: () =>
              of([
                professional('alex', [['g-cut', 'Corte clásico'], ['g-beard', 'Barba']]),
                professional('beto', [['g-cut', 'Corte clásico'], ['g-color', 'Color']]),
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingLandingPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  const text = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

  it("shows the customer's next appointment in Bogotá time", async () => {
    await open({ roles: ['Customer'], appointments: [next] });

    expect(list).toHaveBeenCalledWith({ scope: 'Upcoming', page: 1, pageSize: 1 });
    const card = text('next-appointment')!;
    expect(card).toContain('Martes, 10 de noviembre');
    expect(card).toMatch(/9:00/);
    expect(card).toContain('Alex · Corte clásico');
    expect(card).not.toContain('Todavía no tienes citas');
  });

  it('says there is no appointment only when the customer has none', async () => {
    await open({ roles: ['Customer'], appointments: [] });

    expect(text('next-appointment')).toContain('Todavía no tienes citas agendadas.');
  });

  it('does not claim there are no appointments when they could not be loaded', async () => {
    await open({ roles: ['Customer'], failAppointments: true });

    expect(text('next-appointment')).toContain('No pudimos cargar tu próximo turno.');
    expect(text('next-appointment')).not.toContain('Todavía no tienes citas');
  });

  it('asks a visitor to sign in instead of saying they have no appointments', async () => {
    await open({ roles: null });

    expect(list).not.toHaveBeenCalled();
    expect(text('next-appointment')).toContain('Inicia sesión para ver tu próximo turno.');
  });

  it('lists the services the professionals offer, the most offered first, without the fixed placeholders', async () => {
    await open({ roles: null });

    const chips = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.booking-landing-page__chip')).map(
      (chip) => chip.textContent!.trim(),
    );
    expect(chips).toEqual(['Corte clásico', 'Barba', 'Color']);
    expect(text('services')).not.toContain('Corte + Barba');
  });
});
