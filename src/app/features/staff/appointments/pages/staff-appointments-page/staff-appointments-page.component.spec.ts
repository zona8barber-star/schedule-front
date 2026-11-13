import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentResponse, AppointmentServiceOption } from '../../../../../core/models/appointment.models';
import { ServiceRecordEligibilityService } from '../../../../../core/services/service-record-eligibility.service';
import { StaffAppointmentsApiService } from '../../../../../core/services/staff-appointments-api.service';
import { setDeviceTimeZone } from '../../../../../testing/device-time-zone';
import { StaffAppointmentsPageComponent } from './staff-appointments-page.component';

describe('StaffAppointmentsPageComponent (service and duration)', () => {
  let fixture: ComponentFixture<StaffAppointmentsPageComponent>;
  let component: StaffAppointmentsPageComponent;
  let api: {
    list: ReturnType<typeof vi.fn>;
    serviceOptions: ReturnType<typeof vi.fn>;
    createManual: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const options: AppointmentServiceOption[] = [
    { generalServiceId: 'g-cut', name: 'Corte', categoryId: 'c-1', categoryName: 'Barbería', durationMinutes: 30 },
    { generalServiceId: 'g-beard', name: 'Barba', categoryId: 'c-1', categoryName: 'Barbería', durationMinutes: 20 },
  ];

  const appointment: AppointmentResponse = {
    id: 'a-1',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: null,
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    startsAtUtc: '2026-11-07T15:00:00Z',
    endsAtUtc: '2026-11-07T15:30:00Z',
    status: 'Confirmed',
    source: 'Manual',
    notes: null,
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    reservedDurationMinutes: 30,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };
  const legacy: AppointmentResponse = {
    ...appointment,
    id: 'a-legacy',
    generalServiceId: null,
    generalServiceName: null,
    reservedDurationMinutes: null,
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));

    api = {
      list: vi.fn(() => of({ items: [appointment, legacy], page: 1, pageSize: 20, totalCount: 2 })),
      serviceOptions: vi.fn(() => of(options)),
      createManual: vi.fn(() => of(appointment)),
      update: vi.fn(() => of(appointment)),
    };

    await TestBed.configureTestingModule({
      imports: [StaffAppointmentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: StaffAppointmentsApiService, useValue: api },
        { provide: ServiceRecordEligibilityService, useValue: { canRegister: signal(false) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffAppointmentsPageComponent);
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

  it('creates by service, showing its duration read-only and sending neither an end time nor a duration', async () => {
    component.openCreateModal();
    await render();

    expect(api.serviceOptions).toHaveBeenCalledTimes(1);
    const select = fixture.nativeElement.querySelector('#createService') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Selecciona un servicio',
      'Corte · 30 min',
      'Barba · 20 min',
    ]);

    component.createForm.patchValue({
      startsAt: '2026-11-07T10:00',
      generalServiceId: 'g-beard',
      customerName: 'Juan Pérez',
    });
    fixture.detectChanges();
    const duration = fixture.nativeElement.querySelector('#createDuration') as HTMLInputElement;
    expect(duration.readOnly).toBe(true);
    expect(duration.value).toBe('20');

    await component.submitCreate();

    const body = api.createManual.mock.calls[0][0];
    expect(body.generalServiceId).toBe('g-beard');
    expect(body).not.toHaveProperty('endsAtUtc');
    expect(body).not.toHaveProperty('durationMinutes');
  });

  // SONDA BUG-027: «Nueva cita» accepted any length and only the server answered, with a technical 400.
  it('limits «Nueva cita» to the server lengths and explains an over-long or blank name', async () => {
    component.openCreateModal();
    await render();
    const element = fixture.nativeElement as HTMLElement;
    const limit = (selector: string) => element.querySelector<HTMLInputElement>(selector)?.maxLength;

    expect(limit('#createCustomerName')).toBe(120);
    expect(limit('#createCustomerPhone')).toBe(40);
    expect(element.querySelector<HTMLTextAreaElement>('#createNotes')?.maxLength).toBe(2000);

    component.createForm.patchValue({ startsAt: '2026-11-07T10:00', generalServiceId: 'g-cut', customerName: 'a'.repeat(121) });
    component.createForm.controls.customerName.markAsTouched();
    fixture.detectChanges();
    expect(element.textContent).toContain('Puede tener como máximo 120 caracteres (ahora tiene 121).');

    component.createForm.patchValue({ customerName: '   ' });
    await component.submitCreate();
    expect(api.createManual).not.toHaveBeenCalled();
  });

  it('requires a service to create', async () => {
    component.openCreateModal();
    await render();
    component.createForm.patchValue({ startsAt: '2026-11-07T10:00', customerName: 'Juan Pérez' });

    await component.submitCreate();

    expect(api.createManual).not.toHaveBeenCalled();
    expect(component.showCreateError('generalServiceId', 'required')).toBe(true);
  });

  it('edits keeping the service unless it changes, never sending a duration or an end time', async () => {
    component.startEdit(appointment);
    await render();
    expect(component.editForm.controls.generalServiceId.value).toBe('g-cut');

    await component.submitEdit();
    let body = api.update.mock.calls[0][1];
    expect(body.generalServiceId).toBeNull();
    expect(body).not.toHaveProperty('endsAtUtc');
    expect(body).not.toHaveProperty('durationMinutes');

    component.startEdit(appointment);
    component.editForm.controls.generalServiceId.setValue('g-beard');
    expect(component.editDurationMinutes(appointment)).toBe(20);
    await component.submitEdit();
    body = api.update.mock.calls[1][1];
    expect(body.generalServiceId).toBe('g-beard');
    expect(body).not.toHaveProperty('durationMinutes');
  });

  it('asks for the active appointments of today, then upcoming and the filtered history, keeping the tab in the URL', async () => {
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-11-06', to: '2026-11-06', status: 'Pending,Confirmed', sort: 'Asc', scope: 'Agenda', page: 1 }),
    );

    component.setTab('upcoming');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=upcoming');
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-11-07', status: 'Pending,Confirmed', sort: 'Asc', scope: 'Agenda' }),
    );

    component.setTab('history');
    await render();
    // The history: the last 30 days, today included, by default.
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-10-08', to: '2026-11-06', sort: 'Desc', scope: 'History', page: 1 }),
    );

    component.onHistoryFilterChange({ status: 'NoShow' });
    await render();
    component.onHistoryFromChange('2026-01-01');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=history&status=NoShow&from=2026-01-01&to=2026-01-30');
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-01-01', to: '2026-01-30', status: 'NoShow', sort: 'Desc', scope: 'History', page: 1 }),
    );

    // A hand-written range of 31 days is explained, not sent.
    const calls = api.list.mock.calls.length;
    await TestBed.inject(Router).navigateByUrl('/?tab=history&from=2026-01-01&to=2026-01-31');
    await render();
    expect(api.list.mock.calls.length).toBe(calls);
    expect(component.rangeError()).toContain('30 días');
  });

  it('lets a legacy appointment keep having no service', async () => {
    component.startEdit(legacy);
    await render();

    expect(component.editForm.controls.generalServiceId.value).toBe('');
    expect(component.editDurationMinutes(legacy)).toBe(30);
    await component.submitEdit();
    expect(api.update.mock.calls[0][1].generalServiceId).toBeNull();
  });
});

describe('StaffAppointmentsPageComponent in Bogotá time, with a confirm action', () => {
  let fixture: ComponentFixture<StaffAppointmentsPageComponent>;
  let component: StaffAppointmentsPageComponent;
  let restoreTimeZone: () => void;
  let api: {
    list: ReturnType<typeof vi.fn>;
    serviceOptions: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
  };

  // A booking at 09:00 in Bogotá (14:00Z), pending approval, and one already confirmed.
  const pending: AppointmentResponse = {
    id: 'a-pending',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: 'u-1',
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    startsAtUtc: '2026-11-10T14:00:00Z',
    endsAtUtc: '2026-11-10T14:30:00Z',
    status: 'Pending',
    source: 'CustomerBooking',
    notes: null,
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    reservedDurationMinutes: 30,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };
  const confirmed: AppointmentResponse = { ...pending, id: 'a-confirmed', status: 'Confirmed', customerName: 'Diego' };

  // SONDA BUG-033: the device is in UTC.
  beforeAll(() => (restoreTimeZone = setDeviceTimeZone('UTC')));
  afterAll(() => restoreTimeZone());

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 21:00 on Nov 6 in Bogotá: the UTC device already says Nov 7.
    vi.setSystemTime(new Date('2026-11-07T02:00:00Z'));

    api = {
      list: vi.fn(() => of({ items: [pending, confirmed], page: 1, pageSize: 20, totalCount: 2 })),
      serviceOptions: vi.fn(() => of([])),
      update: vi.fn(() => of(pending)),
      confirm: vi.fn(() => of({ ...pending, status: 'Confirmed' })),
    };

    await TestBed.configureTestingModule({
      imports: [StaffAppointmentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: StaffAppointmentsApiService, useValue: api },
        { provide: ServiceRecordEligibilityService, useValue: { canRegister: signal(false) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffAppointmentsPageComponent);
    component = fixture.componentInstance;
    await render();
  });

  afterEach(() => vi.useRealTimers());

  async function render(): Promise<void> {
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  const cards = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.appt-card'));
  const buttonsOf = (card: HTMLElement) =>
    Array.from(card.querySelectorAll<HTMLButtonElement>('button')).map((button) => button.textContent!.trim());

  it('asks for the agenda of the Bogotá day, not the device day', () => {
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-11-06', to: '2026-11-06' }));
  });

  it('shows the appointment at 9:00 (Bogotá), not at the device time', () => {
    expect(component.formatTime(pending.startsAtUtc)).toMatch(/^9:00/);
    expect(cards()[0].textContent).toMatch(/10 nov 2026, 9:00/);
    expect(cards()[0].textContent).not.toMatch(/2:00\s*p/);
  });

  it('edits in Bogotá time and sends the same instant back', async () => {
    component.startEdit(pending);
    expect(component.editForm.controls.startsAt.value).toBe('2026-11-10T09:00');

    component.editForm.controls.startsAt.setValue('2026-11-10T10:30');
    await component.submitEdit();
    expect(api.update.mock.calls[0][1].startsAtUtc).toBe('2026-11-10T15:30:00.000Z');
  });

  // SONDA BUG-028: the professional approves online bookings from the agenda.
  it('offers «Confirmar» only on pending appointments', () => {
    const [pendingCard, confirmedCard] = cards();
    expect(buttonsOf(pendingCard)).toContain('Confirmar');
    expect(buttonsOf(confirmedCard)).not.toContain('Confirmar');
    expect(buttonsOf(confirmedCard)).toContain('Completar');
  });

  it('confirms a pending appointment and reloads the agenda', async () => {
    const callsBefore = api.list.mock.calls.length;
    const confirmButton = Array.from(cards()[0].querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent!.trim() === 'Confirmar',
    )!;

    confirmButton.click();
    await render();

    expect(api.confirm).toHaveBeenCalledWith('a-pending');
    expect(api.list.mock.calls.length).toBe(callsBefore + 1);
    expect(component.successMessage()).toBe('Cita confirmada. Le avisamos al cliente.');
  });

  it('does not confirm an appointment that is not pending', async () => {
    await component.confirmAppointment(confirmed);
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
