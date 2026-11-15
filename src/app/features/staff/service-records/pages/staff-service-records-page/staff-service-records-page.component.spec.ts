import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { ServiceRecordView } from '../../../../../core/models/service-record.models';
import { StaffServiceRecordsPageComponent } from './staff-service-records-page.component';

describe('StaffServiceRecordsPageComponent', () => {
  let fixture: ComponentFixture<StaffServiceRecordsPageComponent>;
  let component: StaffServiceRecordsPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const record = (id: string, status: ServiceRecordView['status']): ServiceRecordView => ({
    id,
    status,
    appointmentId: null,
    appointmentStartsAt: null,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    serviceId: null,
    serviceName: 'Corte',
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    performedOn: '2026-11-10',
    customerId: null,
    customerName: 'Cliente de paso',
    notes: null,
    registeredAt: '2026-11-10T15:00:00Z',
    registeredByName: 'Alex',
    approval: null,
    rejectionReason: status === 'Rejected' ? 'Duplicado' : null,
    rejectedAt: null,
    rejectedByName: null,
    version: 1,
  });

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushOwnRecords(items: ServiceRecordView[], totalCount = items.length, page = 1): void {
    const request = httpMock.expectOne((candidate) => candidate.method === 'GET' && candidate.url === `${api}/staff/service-records`);
    expect(request.request.params.get('page')).toBe(String(page));
    request.flush({ items, page, pageSize: 25, totalCount });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffServiceRecordsPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(StaffServiceRecordsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('keeps the own records in read only and points to the bills, without any way to register', async () => {
    flushOwnRecords([record('r-1', 'Pending'), record('r-2', 'Rejected')]);
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('El registro de servicios realizados se reemplazó por las cuentas');
    expect(element.querySelector('a[href="/bills"]')).not.toBeNull();
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelectorAll('[data-testid="own-records"] li').length).toBe(2);
    expect(element.textContent).toContain('Motivo del rechazo: Duplicado');
    // No catalog, appointments or eligibility are read any more: nothing to register.
    httpMock.expectNone(`${api}/staff/service-records/catalog`);
    httpMock.expectNone(`${api}/staff/service-records/eligibility`);
  });

  it('pages through the own records', async () => {
    flushOwnRecords([record('r-1', 'Approved')], 30);
    await settle();

    const paging = component.onRecordsPageChange(2);
    flushOwnRecords([record('r-26', 'Approved')], 30, 2);
    await paging;

    expect(component.records().map((item) => item.id)).toEqual(['r-26']);
  });
});
