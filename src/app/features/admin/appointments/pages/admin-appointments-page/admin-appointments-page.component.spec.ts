import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentResponse, AppointmentServiceOption } from '../../../../../core/models/appointment.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminAppointmentsApiService } from '../../../../../core/services/admin-appointments-api.service';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { AdminAppointmentsPageComponent } from './admin-appointments-page.component';

describe('AdminAppointmentsPageComponent (service and duration)', () => {
  let fixture: ComponentFixture<AdminAppointmentsPageComponent>;
  let component: AdminAppointmentsPageComponent;
  let api: {
    list: ReturnType<typeof vi.fn>;
    serviceOptions: ReturnType<typeof vi.fn>;
    createManual: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const staffMember = (id: string, name: string): StaffListItem => ({
    staffProfileId: id,
    userId: `u-${id}`,
    fullName: name,
    email: `${id}@example.com`,
    phoneNumber: null,
    displayName: name,
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
    createdAt: '',
    updatedAt: null,
  });

  const optionsByStaff: Record<string, AppointmentServiceOption[]> = {
    'st-1': [
      { generalServiceId: 'g-cut', name: 'Corte', categoryId: 'c-1', categoryName: 'Barbería', durationMinutes: 30 },
      { generalServiceId: 'g-beard', name: 'Barba', categoryId: 'c-1', categoryName: 'Barbería', durationMinutes: 20 },
    ],
    'st-2': [{ generalServiceId: 'g-color', name: 'Color', categoryId: 'c-2', categoryName: 'Color', durationMinutes: 90 }],
  };

  const appointment: AppointmentResponse = {
    id: 'a-1',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    customerUserId: null,
    customerName: 'Carla',
    customerEmail: null,
    customerPhone: null,
    startsAtUtc: '2026-11-07T15:00:00Z',
    endsAtUtc: '2026-11-07T15:40:00Z',
    status: 'Confirmed',
    source: 'Manual',
    notes: null,
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    reservedDurationMinutes: 40,
    createdAtUtc: '2026-11-06T15:00:00Z',
    updatedAtUtc: null,
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));

    api = {
      list: vi.fn(() => of({ items: [appointment], page: 1, pageSize: 20, totalCount: 1 })),
      serviceOptions: vi.fn((staffProfileId: string) => of(optionsByStaff[staffProfileId] ?? [])),
      createManual: vi.fn(() => of(appointment)),
      update: vi.fn(() => of(appointment)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminAppointmentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminServiceCatalogApiService, useValue: { listGeneralServices: () => of([]) } },
        { provide: AdminAppointmentsApiService, useValue: api },
        { provide: AdminStaffApiService, useValue: { list: () => of([staffMember('st-1', 'Alex'), staffMember('st-2', 'Beto')]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAppointmentsPageComponent);
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

  it('reloads the services when the professional changes and prefills the duration from the offering', async () => {
    expect(api.serviceOptions).toHaveBeenLastCalledWith('st-1');
    expect(component.createServiceOptions().map((option) => option.generalServiceId)).toEqual(['g-cut', 'g-beard']);

    component.createForm.controls.generalServiceId.setValue('g-beard');
    expect(component.createForm.controls.durationMinutes.value).toBe(20);

    component.createForm.controls.staffProfileId.setValue('st-2');
    await render();
    expect(api.serviceOptions).toHaveBeenLastCalledWith('st-2');
    expect(component.createForm.controls.generalServiceId.value).toBe('');
    expect(component.createServiceOptions().map((option) => option.generalServiceId)).toEqual(['g-color']);
  });

  it('creates with the offering duration (not sent) or with an admin override (sent), never an end time', async () => {
    component.createForm.patchValue({ startsAt: '2026-11-07T10:00', customerName: 'Juan Pérez' });
    component.createForm.controls.generalServiceId.setValue('g-cut');

    await component.submitCreate();
    let body = api.createManual.mock.calls[0][0];
    expect(body).toEqual(expect.objectContaining({ staffProfileId: 'st-1', generalServiceId: 'g-cut', durationMinutes: null }));
    expect(body).not.toHaveProperty('endsAtUtc');

    component.openCreateForm();
    await render();
    component.createForm.patchValue({ startsAt: '2026-11-07T11:00', customerName: 'Juan Pérez' });
    component.createForm.controls.generalServiceId.setValue('g-cut');
    component.createForm.controls.durationMinutes.setValue(50);

    await component.submitCreate();
    body = api.createManual.mock.calls[1][0];
    expect(body.durationMinutes).toBe(50);
  });

  it('rejects a duration outside 10–240 minutes', async () => {
    component.createForm.patchValue({ startsAt: '2026-11-07T10:00', customerName: 'Juan Pérez' });
    component.createForm.controls.generalServiceId.setValue('g-cut');
    component.createForm.controls.durationMinutes.setValue(300);

    await component.submitCreate();

    expect(api.createManual).not.toHaveBeenCalled();
    expect(component.showCreateError('durationMinutes', 'max')).toBe(true);
  });

  it('edits preselecting the service and duration, sending only what changed', async () => {
    component.startEdit(appointment);
    await render();

    expect(api.serviceOptions).toHaveBeenLastCalledWith('st-1');
    expect(component.editForm.controls.generalServiceId.value).toBe('g-cut');
    expect(component.editForm.controls.durationMinutes.value).toBe(40);

    await component.submitEdit();
    let body = api.update.mock.calls[0][1];
    expect(body).toEqual(expect.objectContaining({ generalServiceId: null, durationMinutes: null }));
    expect(body).not.toHaveProperty('endsAtUtc');

    component.startEdit(appointment);
    await render();
    component.editForm.controls.generalServiceId.setValue('g-beard');
    expect(component.editForm.controls.durationMinutes.value).toBe(20);
    component.editForm.controls.durationMinutes.setValue(25);

    await component.submitEdit();
    body = api.update.mock.calls[1][1];
    expect(body).toEqual(expect.objectContaining({ generalServiceId: 'g-beard', durationMinutes: 25 }));
  });

  it('asks the server for today first, soonest first, on the first page', () => {
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-11-06', to: '2026-11-06', sort: 'Asc', scope: 'Agenda', page: 1, pageSize: 25 }),
    );
  });

  it('keeps the tab and the filters in the URL and sends them to the server', async () => {
    component.setTab('past');
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=past');
    // The history: the last 30 days up to yesterday by default.
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-10-07', to: '2026-11-05', sort: 'Desc', scope: 'History', page: 1 }),
    );

    component.onFilterChange({ status: 'Cancelled', customer: 'carla' });
    await render();
    expect(TestBed.inject(Router).url).toBe('/?tab=past&status=Cancelled&customer=carla');
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Cancelled', customer: 'carla', page: 1 }));

    component.onPageChange(2);
    await render();
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Cancelled', page: 2 }));
  });

  it('keeps the history within 30 days, reaches older periods and explains a longer range without asking', async () => {
    component.setTab('past');
    await render();

    component.setDateFrom('2026-01-01');
    await render();
    expect(TestBed.inject(Router).url).toContain('from=2026-01-01&to=2026-01-30');
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-01-01', to: '2026-01-30', scope: 'History' }),
    );

    const calls = api.list.mock.calls.length;
    await TestBed.inject(Router).navigateByUrl('/?tab=past&from=2026-01-01&to=2026-01-31');
    await render();
    expect(api.list.mock.calls.length).toBe(calls);
    expect(component.rangeError()).toContain('30 días');
  });

  it('does not limit the agenda: upcoming has no end date and no 30-day check', async () => {
    component.setTab('upcoming');
    await render();
    component.setDateTo('2027-06-30');
    await render();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-11-07', to: '2027-06-30', scope: 'Agenda' }),
    );
    expect(component.rangeError()).toBeNull();
  });

  it('shows the service of each appointment in the agenda', async () => {
    component.setTab('upcoming');
    await render();
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-11-07', to: null, sort: 'Asc', scope: 'Agenda' }));
    const cell = fixture.nativeElement.querySelector('[data-testid="appointment-service"]') as HTMLElement;
    expect(cell.textContent?.trim()).toBe('Corte · 40 min');
  });
});
