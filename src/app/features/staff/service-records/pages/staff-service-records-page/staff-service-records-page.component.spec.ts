import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
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
    {
      id: 'a-done',
      startsAt: hoursAgo(2),
      customerName: 'Cliente cita',
      status: 'Completed',
      registeredGeneralServiceIds: ['g-beard'],
      generalServiceId: 'g-beard',
      generalServiceName: 'Barba',
    },
    {
      id: 'a-open',
      startsAt: hoursAgo(1),
      customerName: 'Otra cita',
      status: 'Confirmed',
      registeredGeneralServiceIds: [],
      generalServiceId: 'g-cut',
      generalServiceName: 'Corte',
    },
    {
      id: 'a-legacy',
      startsAt: hoursAgo(3),
      customerName: 'Cita antigua',
      status: 'Completed',
      registeredGeneralServiceIds: [],
      generalServiceId: null,
      generalServiceName: null,
    },
  ];

  const created = (id: string, generalServiceId: string, serviceName: string): ServiceRecordView => ({
    id,
    status: 'Pending',
    appointmentId: null,
    appointmentStartsAt: null,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    serviceId: null,
    serviceName,
    generalServiceId,
    generalServiceName: serviceName,
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

  /** The own records are a paginated GET (pending first); the POST of a registration shares the URL without params. */
  function flushOwnRecords(items: unknown[] = [], totalCount = items.length, page = 1): TestRequest {
    const request = httpMock.expectOne(
      (candidate) => candidate.method === 'GET' && candidate.url === `${api}/staff/service-records`,
    );
    expect(request.request.params.get('page')).toBe(String(page));
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush({ items, page, pageSize: 25, totalCount });
    return request;
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
        { id: 'g-cut', name: 'Corte', categoryId: 'c-barber', categoryName: 'Barbería' },
        { id: 'g-beard', name: 'Barba', categoryId: 'c-barber', categoryName: 'Barbería' },
        { id: 'g-nails', name: 'Manicure', categoryId: 'c-nails', categoryName: 'Uñas' },
      ]);
      httpMock.expectOne(`${api}/staff/service-records/appointments`).flush(appointments);
      flushOwnRecords();
    }
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('lists recent appointments, completed ones included, without using the Staff-only agenda', async () => {
    await open();

    expect(component.appointments().map((item) => item.id)).toEqual(['a-done', 'a-open', 'a-legacy']);
    httpMock.expectNone(`${api}/staff/appointments`);
    expect(fixture.nativeElement.textContent).toContain('Citas recientes');
  });

  it('registers from a completed appointment, without offering the services already registered there', async () => {
    await open();
    component.registerFrom('a-done');
    fixture.detectChanges();

    expect(component.mode()).toBe('appointment');
    expect(component.isAlreadyRegistered('g-beard')).toBe(true);
    // The booked service is already registered there: nothing is preselected.
    expect(component.selectedServiceIds()).toEqual([]);
    component.toggleService('g-beard');
    expect(component.selectedServiceIds()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('(ya registrado)');

    component.toggleService('g-cut');
    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    expect(req.request.body.appointmentId).toBe('a-done');
    expect(req.request.body.generalServiceIds).toEqual(['g-cut']);
    expect(req.request.body.serviceIds).toBeUndefined();
    expect(req.request.body.performedOn).toBeNull();
    req.flush([created('r-1', 'g-cut', 'Corte')]);
    await flushMicrotasks();
    flushOwnRecords([created('r-1', 'g-cut', 'Corte')]);
    await submitting;

    // The appointment now shows both services as registered.
    expect(component.appointments().find((item) => item.id === 'a-done')!.registeredGeneralServiceIds).toEqual([
      'g-beard',
      'g-cut',
    ]);
  });

  it('registers several services without an appointment, then starts a fresh registration key', async () => {
    await open();
    component.form.patchValue({ customerName: 'Cliente de paso' });
    component.toggleService('g-cut');
    component.toggleService('g-beard');

    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    const firstKey = req.request.body.idempotencyKey;
    expect(req.request.body).toEqual({
      appointmentId: null,
      performedOn: bogotaToday(),
      customerName: 'Cliente de paso',
      generalServiceIds: ['g-cut', 'g-beard'],
      notes: null,
      idempotencyKey: firstKey,
    });
    req.flush([created('r-1', 'g-cut', 'Corte'), created('r-2', 'g-beard', 'Barba')]);
    await flushMicrotasks();
    flushOwnRecords([created('r-1', 'g-cut', 'Corte'), created('r-2', 'g-beard', 'Barba')]);
    await submitting;

    expect(component.successMessage()).toContain('2 servicios registrados');
    component.toggleService('g-cut');
    const again = component.submit();
    const second = httpMock.expectOne(`${api}/staff/service-records`);
    expect(second.request.body.idempotencyKey).not.toBe(firstKey);
    second.flush([created('r-3', 'g-cut', 'Corte')]);
    await flushMicrotasks();
    flushOwnRecords([created('r-3', 'g-cut', 'Corte')]);
    await again;
  });

  it('preselects the appointment of the link', async () => {
    await open({ appointmentId: 'a-open' });

    expect(component.mode()).toBe('appointment');
    expect(component.form.controls.appointmentId.value).toBe('a-open');
    // Prefilled with the service booked with the appointment.
    expect(component.selectedServiceIds()).toEqual(['g-cut']);
  });

  it('prefills the booked service when an appointment is chosen, and nothing for legacy appointments', async () => {
    await open();
    component.setMode('appointment');

    component.form.controls.appointmentId.setValue('a-open');
    expect(component.selectedServiceIds()).toEqual(['g-cut']);

    component.form.controls.appointmentId.setValue('a-legacy');
    expect(component.selectedServiceIds()).toEqual([]);

    component.registerFrom('a-open');
    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    expect(req.request.body.generalServiceIds).toEqual(['g-cut']);
    req.flush([created('r-9', 'g-cut', 'Corte')]);
    await flushMicrotasks();
    flushOwnRecords([created('r-9', 'g-cut', 'Corte')]);
    await submitting;
  });

  it('groups the general services by category', async () => {
    await open();

    expect(component.catalogGroups().map((group) => [group.categoryName, group.services.map((s) => s.id)])).toEqual([
      ['Barbería', ['g-cut', 'g-beard']],
      ['Uñas', ['g-nails']],
    ]);
    const names = Array.from(
      fixture.nativeElement.querySelectorAll('.records__group-name') as NodeListOf<HTMLElement>,
    ).map((element) => element.textContent?.trim());
    expect(names).toEqual(['Barbería', 'Uñas']);
  });

  it('pages the own records on the server, so every record stays reachable', async () => {
    await open();
    const onPage = component.onRecordsPageChange(2);
    await flushMicrotasks();
    flushOwnRecords([created('r-26', 'g-cut', 'Corte')], 26, 2);
    await onPage;
    fixture.detectChanges();

    expect(component.records().map((record) => record.id)).toEqual(['r-26']);
    expect(component.recordsTotal()).toBe(26);
    expect(fixture.nativeElement.textContent).toContain('Página 2 de 2');
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

    component.toggleService('g-cut');
    const submitting = component.submit();
    httpMock.expectOne(`${api}/staff/service-records`).flush(
      { detail: 'El servicio "Corte" ya está registrado en esta cita.' },
      { status: 409, statusText: 'Conflict' },
    );
    await submitting;
    expect(component.errorMessage()).toBe('El servicio "Corte" ya está registrado en esta cita.');
  });
});
