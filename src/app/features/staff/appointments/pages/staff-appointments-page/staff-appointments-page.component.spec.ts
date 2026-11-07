import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentResponse, AppointmentServiceOption } from '../../../../../core/models/appointment.models';
import { ServiceRecordEligibilityService } from '../../../../../core/services/service-record-eligibility.service';
import { StaffAppointmentsApiService } from '../../../../../core/services/staff-appointments-api.service';
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
