import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { IncomeEntryView } from '../../../../../core/models/income.models';
import { AdminIncomeListPageComponent } from './admin-income-list-page.component';

describe('AdminIncomeListPageComponent', () => {
  let fixture: ComponentFixture<AdminIncomeListPageComponent>;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const entries: IncomeEntryView[] = [
    {
      id: 'i-1',
      kind: 'Service',
      serviceId: 's-1',
      serviceName: 'Corte',
      basePrice: 25000,
      staffProfileId: 'st-1',
      staffDisplayName: 'Alex',
      amount: 25000,
      isPromo: false,
      businessPercentage: 40,
      businessAmount: 10000,
      professionalAmount: 15000,
      occurredOn: '2026-06-10',
      createdAt: '',
      updatedAt: null,
    },
    {
      id: 'i-2',
      kind: 'MembershipSale',
      serviceId: null,
      serviceName: null,
      basePrice: 0,
      staffProfileId: null,
      staffDisplayName: null,
      amount: 250000,
      isPromo: false,
      businessPercentage: 100,
      businessAmount: 250000,
      professionalAmount: 0,
      occurredOn: '2026-06-10',
      createdAt: '',
      updatedAt: null,
    },
  ];

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminIncomeListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncomeListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/staff`).flush([]);
    await flushMicrotasks();
    httpMock.expectOne((request) => request.url === `${api}/admin/income`).flush(entries);
    await flushMicrotasks();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows membership sales as such, without a professional, and counts them in the day total', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].cells[0].textContent?.trim()).toBe('Corte');
    expect(rows[0].cells[1].textContent?.trim()).toBe('Alex');
    expect(rows[1].cells[0].textContent?.trim()).toBe('Venta de membresía');
    expect(rows[1].cells[1].textContent?.trim()).toBe('—');
    expect(fixture.componentInstance.total()).toBe(275000);
  });
});
