import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { ServiceRecordAppointmentOption, ServiceRecordView } from '../../../../../core/models/service-record.models';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { StaffServiceRecordsPageComponent } from './staff-service-records-page.component';

describe('StaffServiceRecordsPageComponent', () => {
  let fixture: ComponentFixture<StaffServiceRecordsPageComponent>;
  let component: StaffServiceRecordsPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

  const appointments: ServiceRecordAppointmentOption[] = [
    { id: 'a-done', startsAt: hoursAgo(2), customerName: 'Cliente cita', status: 'Completed', registeredServiceIds: ['s-beard'] },
    { id: 'a-open', startsAt: hoursAgo(1), customerName: 'Otra cita', status: 'Confirmed', registeredServiceIds: [] },
  ];

  const created = (id: string, serviceId: string, serviceName: string): ServiceRecordView => ({
    id,
    status: 'Pending',
    appointmentId: null,
    appointmentStartsAt: null,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    serviceId,
    serviceName,
    performedOn: bogotaToday(),
    customerId: null,
    customerName: null,
    notes: null,
    registeredAt: new Date().toISOString(),
    registeredByName: 'Alex',
    approval: null,
    rejectionReason: null,
    rejectedAt: null,
    rejectedByName: null,
    version: 1,
  });

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(options: { appointmentId?: string; hasStaffProfile?: boolean } = {}): Promise<void> {
    const { appointmentId = null, hasStaffProfile = true } = options;
    await TestBed.configureTestingModule({
      imports: [StaffServiceRecordsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(appointmentId ? { appointmentId } : {}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffServiceRecordsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/staff/service-records/eligibility`).flush({
      hasStaffProfile,
      staffProfileId: hasStaffProfile ? 'st-1' : null,
      displayName: hasStaffProfile ? 'Alex' : null,
    });
    await flushMicrotasks();
    if (hasStaffProfile) {
      httpMock.expectOne(`${api}/staff/service-records/catalog`).flush([
        { id: 's-cut', name: 'Corte' },
        { id: 's-beard', name: 'Barba' },
      ]);
      httpMock.expectOne(`${api}/staff/service-records/appointments`).flush(appointments);
      httpMock.expectOne(`${api}/staff/service-records`).flush([]);
    }
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('lists recent appointments, completed ones included, without using the Staff-only agenda', async () => {
    await open();

    expect(component.appointments().map((item) => item.id)).toEqual(['a-done', 'a-open']);
    httpMock.expectNone(`${api}/staff/appointments`);
    expect(fixture.nativeElement.textContent).toContain('Citas recientes');
  });

  it('registers from a completed appointment, without offering the services already registered there', async () => {
    await open();
    component.registerFrom('a-done');
    fixture.detectChanges();

    expect(component.mode()).toBe('appointment');
    expect(component.isAlreadyRegistered('s-beard')).toBe(true);
    component.toggleService('s-beard');
    expect(component.selectedServiceIds()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('(ya registrado)');

    component.toggleService('s-cut');
    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    expect(req.request.body.appointmentId).toBe('a-done');
    expect(req.request.body.serviceIds).toEqual(['s-cut']);
    expect(req.request.body.performedOn).toBeNull();
    req.flush([created('r-1', 's-cut', 'Corte')]);
    await submitting;

    // The appointment now shows both services as registered.
    expect(component.appointments().find((item) => item.id === 'a-done')!.registeredServiceIds).toEqual(['s-beard', 's-cut']);
  });

  it('registers several services without an appointment, then starts a fresh registration key', async () => {
    await open();
    component.form.patchValue({ customerName: 'Cliente de paso' });
    component.toggleService('s-cut');
    component.toggleService('s-beard');

    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    const firstKey = req.request.body.idempotencyKey;
    expect(req.request.body).toEqual({
      appointmentId: null,
      performedOn: bogotaToday(),
      customerName: 'Cliente de paso',
      serviceIds: ['s-cut', 's-beard'],
      notes: null,
      idempotencyKey: firstKey,
    });
    req.flush([created('r-1', 's-cut', 'Corte'), created('r-2', 's-beard', 'Barba')]);
    await submitting;

    expect(component.successMessage()).toContain('2 servicios registrados');
    component.toggleService('s-cut');
    const again = component.submit();
    const second = httpMock.expectOne(`${api}/staff/service-records`);
    expect(second.request.body.idempotencyKey).not.toBe(firstKey);
    second.flush([created('r-3', 's-cut', 'Corte')]);
    await again;
  });

  it('preselects the appointment of the link', async () => {
    await open({ appointmentId: 'a-open' });

    expect(component.mode()).toBe('appointment');
    expect(component.form.controls.appointmentId.value).toBe('a-open');
  });

  it('explains a missing professional profile instead of offering the form', async () => {
    await open({ hasStaffProfile: false });

    expect(fixture.nativeElement.textContent).toContain('no tiene un perfil de profesional activo');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('asks for at least one service and shows API errors', async () => {
    await open();

    await component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Elige al menos un servicio.');
    httpMock.expectNone(`${api}/staff/service-records`);

    component.toggleService('s-cut');
    const submitting = component.submit();
    httpMock.expectOne(`${api}/staff/service-records`).flush(
      { detail: 'El servicio "Corte" ya está registrado en esta cita.' },
      { status: 409, statusText: 'Conflict' },
    );
    await submitting;
    expect(component.errorMessage()).toBe('El servicio "Corte" ya está registrado en esta cita.');
  });
});
