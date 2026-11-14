import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { IncomeEntriesPage, IncomeEntryView } from '../../../../../core/models/income.models';
import { addDaysToDateKey } from '../../../../../core/utils/bogota-date.utils';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminIncomeListPageComponent } from './admin-income-list-page.component';

describe('AdminIncomeListPageComponent', () => {
  let fixture: ComponentFixture<AdminIncomeListPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
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

  function incomePage(overrides: Partial<IncomeEntriesPage> = {}): IncomeEntriesPage {
    return {
      items: entries,
      page: 1,
      pageSize: 20,
      totalCount: 2,
      from: '2026-06-10',
      to: '2026-06-10',
      // The total of every matching entry, not only of this page.
      totalAmount: 900000,
      ...overrides,
    };
  }

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  function expectIncome(): TestRequest {
    return httpMock.expectOne((request) => request.url === `${api}/admin/income`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminIncomeListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncomeListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/staff`).flush([]);
    await flushMicrotasks();
    httpMock.expectOne(`${api}/admin/general-services`).flush([]);
    await flushMicrotasks();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('asks for the last 30 days by default and shows membership sales as such, with the total of every matching entry', async () => {
    const request = expectIncome();
    const today = fixture.componentInstance.today;
    expect(request.request.params.get('from')).toBe(addDaysToDateKey(today, -29));
    expect(request.request.params.get('to')).toBe(today);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('25');
    expect(request.request.params.has('kind')).toBe(false);
    request.flush(incomePage());
    await flushMicrotasks();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].cells[0].textContent?.trim()).toBe('Corte');
    expect(rows[0].cells[1].textContent?.trim()).toBe('Alex');
    expect(rows[1].cells[0].textContent?.trim()).toBe('Venta de membresía');
    expect(rows[1].cells[1].textContent?.trim()).toBe('—');
    expect(fixture.componentInstance.total()).toBe(900000);
  });

  it('keeps the range and the filters in the URL and goes back to the first page', async () => {
    expectIncome().flush(incomePage({ totalCount: 45 }));
    await flushMicrotasks();

    fixture.componentInstance.onPageChange(2);
    await fixture.whenStable();
    expect(router.url).toBe('/?page=2');
    const second = expectIncome();
    expect(second.request.params.get('page')).toBe('2');
    second.flush(incomePage({ page: 2, totalCount: 45 }));
    await flushMicrotasks();
    // The total covers the whole filter, so changing page does not change it.
    expect(fixture.componentInstance.total()).toBe(900000);

    fixture.componentInstance.onFromChange('2026-06-01');
    await fixture.whenStable();
    const ranged = expectIncome();
    expect(ranged.request.params.get('from')).toBe('2026-06-01');
    expect(ranged.request.params.get('page')).toBe('1');
    expect(router.url).toContain('from=2026-06-01');
    expect(router.url).not.toContain('page=');
    ranged.flush(incomePage());
    await flushMicrotasks();

    fixture.componentInstance.onKindChange('MembershipSale');
    await fixture.whenStable();
    const byKind = expectIncome();
    expect(byKind.request.params.get('kind')).toBe('MembershipSale');
    expect(byKind.request.params.get('from')).toBe('2026-06-01');
    byKind.flush(incomePage({ items: [entries[1]], totalCount: 1, totalAmount: 250000 }));
    await flushMicrotasks();
    expect(fixture.componentInstance.total()).toBe(250000);
  });

  it('keeps every range within 30 days when the start or the end moves', async () => {
    expectIncome().flush(incomePage());
    await flushMicrotasks();

    fixture.componentInstance.onFromChange('2026-01-01');
    await fixture.whenStable();
    const moved = expectIncome();
    expect(moved.request.params.get('from')).toBe('2026-01-01');
    expect(moved.request.params.get('to')).toBe('2026-01-30');
    moved.flush(incomePage());
    await flushMicrotasks();

    fixture.componentInstance.onToChange('2026-03-15');
    await fixture.whenStable();
    const ended = expectIncome();
    expect(ended.request.params.get('from')).toBe('2026-02-14');
    expect(ended.request.params.get('to')).toBe('2026-03-15');
    ended.flush(incomePage());
    await flushMicrotasks();
  });

  it('accepts a hand-written range of 30 days and explains, without asking the API, one of 31', async () => {
    expectIncome().flush(incomePage());
    await flushMicrotasks();

    await router.navigateByUrl('/?from=2026-01-01&to=2026-01-30');
    await fixture.whenStable();
    const thirty = expectIncome();
    expect(thirty.request.params.get('from')).toBe('2026-01-01');
    expect(thirty.request.params.get('to')).toBe('2026-01-30');
    thirty.flush(incomePage());
    await flushMicrotasks();
    expect(fixture.componentInstance.rangeError()).toBeNull();

    await router.navigateByUrl('/?from=2026-01-01&to=2026-01-31');
    await fixture.whenStable();
    httpMock.expectNone((request) => request.url === `${api}/admin/income`);
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeError()).toContain('30 días');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('hasta 30 días');
  });

  describe('deleting an income (SONDA BUG-083 and BUG-084)', () => {
    it('names a membership sale as such and formats the amount in pesos', async () => {
      expectIncome().flush(incomePage());
      await flushMicrotasks();
      const modal = TestBed.inject(ConfirmModalService);

      void fixture.componentInstance.deleteEntry(entries[1]);

      expect(modal.state()!.options.message).toBe('Se eliminará el ingreso de "Venta de membresía" ($ 250.000).');
      modal._resolve(false);
    });

    it('refreshes the list and explains when the income was already deleted elsewhere', async () => {
      expectIncome().flush(incomePage());
      await flushMicrotasks();
      const modal = TestBed.inject(ConfirmModalService);

      const deleting = fixture.componentInstance.deleteEntry(entries[0]);
      modal._resolve(true);
      await flushMicrotasks();
      httpMock
        .expectOne(`${api}/admin/income/i-1`)
        .flush({ detail: 'The income entry was not found.' }, { status: 404, statusText: 'Not Found' });
      await flushMicrotasks();
      expectIncome().flush(incomePage({ items: [entries[1]], totalCount: 1 }));
      await deleting;

      expect(fixture.componentInstance.entries().map((entry) => entry.id)).toEqual(['i-2']);
      expect(fixture.componentInstance.errorMessage()).toContain('ya no existe');
    });
  });
});
