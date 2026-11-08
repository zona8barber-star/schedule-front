import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentResponse, CustomerAppointmentsListFilters } from '../../../../../core/models/appointment.models';
import { CustomerAppointmentsApiService } from '../../../../../core/services/customer-appointments-api.service';
import { CustomerReviewsApiService } from '../../../../../core/services/customer-reviews-api.service';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { CustomerAppointmentsPageComponent } from './customer-appointments-page.component';

describe('CustomerAppointmentsPageComponent (service and rescheduling)', () => {
  let fixture: ComponentFixture<CustomerAppointmentsPageComponent>;
  let component: CustomerAppointmentsPageComponent;
  let getSlots: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;

  const booked: AppointmentResponse = {
    id: 'a-1',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: 'u-1',
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    startsAtUtc: '2026-11-10T15:00:00Z',
    endsAtUtc: '2026-11-10T15:45:00Z',
    status: 'Pending',
    source: 'CustomerBooking',
    notes: null,
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    reservedDurationMinutes: 45,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };

  const legacy: AppointmentResponse = {
    ...booked,
    id: 'a-legacy',
    startsAtUtc: '2026-11-11T15:00:00Z',
    endsAtUtc: '2026-11-11T15:30:00Z',
    generalServiceId: null,
    generalServiceName: null,
    reservedDurationMinutes: null,
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));

    getSlots = vi.fn((staffProfileId: string, from: string, to: string) =>
      of({ staffProfileId, from, to, slotDurationMinutes: 45, slots: [], generalServiceId: null, slotStepMinutes: 15 }),
    );

    // Upcoming holds both bookings; the past (review window and history) is empty.
    list = vi.fn((filters: CustomerAppointmentsListFilters) => {
      const items = filters.scope === 'Upcoming' ? [booked, legacy] : [];
      return of({ items, page: filters.page ?? 1, pageSize: filters.pageSize ?? 20, totalCount: items.length });
    });

    await TestBed.configureTestingModule({
      imports: [CustomerAppointmentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomerAppointmentsApiService, useValue: { list } },
        { provide: CustomerReviewsApiService, useValue: { list: () => of([]) } },
        { provide: PublicAvailabilityApiService, useValue: { getSlots } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerAppointmentsPageComponent);
    component = fixture.componentInstance;
    await render();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('shows the booked service and its duration in the list', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="appointment-service"]') as NodeListOf<HTMLElement>,
    ).map((element) => element.textContent?.trim());
    expect(labels).toEqual(['Corte · 45 min']);
  });

  it('asks for the upcoming page, the review window and the history page', () => {
    // Upcoming is a queue (no dates); the history asks for the last 30 days by default.
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ scope: 'Upcoming', page: 1, pageSize: 25 }));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ scope: 'Past', from: '2026-10-29', pageSize: 100 }));
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'Past', from: '2026-10-08', to: '2026-11-06', status: null, page: 1, pageSize: 25 }),
    );
  });

  it('reaches older history one window of up to 30 days at a time and never sends a longer one', async () => {
    component.setTab('history');
    await render();
    component.onHistoryFromChange('2025-12-20');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=history&from=2025-12-20&to=2026-01-18');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'Past', from: '2025-12-20', to: '2026-01-18' }));

    list.mockClear();
    await TestBed.inject(Router).navigateByUrl('/?tab=history&from=2025-12-20&to=2026-01-19');
    await render();
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ scope: 'Past', from: '2025-12-20' }));
    expect(component.rangeError()).toContain('30 días');
  });

  it('explains that the dates filter by the scheduled day, so a cancelled future appointment shows on its own date', async () => {
    component.setTab('history');
    await render();
    const note = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="history-date-note"]');
    expect(note?.textContent).toContain('día programado');
    expect(note?.textContent).toContain('cancelada');
  });

  it('keeps the tab, the history status and the page in the URL', async () => {
    component.setTab('history');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=history');

    component.onHistoryStatusChange('Cancelled');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=history&status=Cancelled');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'Past', status: 'Cancelled', page: 1 }));

    component.onPageChange(2);
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=history&status=Cancelled&page=2');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'Past', status: 'Cancelled', page: 2 }));
  });

  it('reschedules with the reserved duration', async () => {
    component.openReschedule(booked);
    await render();

    expect(getSlots).toHaveBeenCalledWith('st-1', expect.any(String), expect.any(String), { durationMinutes: 45 });
  });

  it('reschedules an appointment without a stored duration with its current length', async () => {
    component.openReschedule(legacy);
    await render();

    expect(getSlots).toHaveBeenCalledWith('st-1', expect.any(String), expect.any(String), { durationMinutes: 30 });
  });
});
