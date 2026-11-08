import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { CustomerListItem } from '../../../../../core/models/customer.models';
import { PagedResult } from '../../../../../core/models/paged-result.models';
import { AdminCustomersListPageComponent } from './admin-customers-list-page.component';

describe('AdminCustomersListPageComponent', () => {
  let fixture: ComponentFixture<AdminCustomersListPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const customers: CustomerListItem[] = [
    {
      id: 'c-1',
      fullName: 'Carlos Pérez',
      phone: '3001234567',
      email: 'carlos@example.com',
      linkedAccount: {
        userId: 'u-1',
        fullName: 'Carlos App',
        email: 'app@example.com',
        phoneNumber: null,
        linkedAt: '2026-10-20T10:00:00Z',
        linkedByName: null,
      },
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'c-2',
      fullName: 'Ana Gómez',
      phone: '3109998888',
      email: 'ana@example.com',
      linkedAccount: null,
      createdAt: '2026-10-02T10:00:00Z',
    },
  ];

  function page(items: CustomerListItem[], totalCount = items.length, pageNumber = 1): PagedResult<CustomerListItem> {
    return { items, page: pageNumber, pageSize: 25, totalCount };
  }

  function expectList(): TestRequest {
    return httpMock.expectOne((request) => request.url === base);
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomersListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomersListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists customers with their account status, asking for the first page', async () => {
    const request = expectList();
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('25');
    expect(request.request.params.has('q')).toBe(false);
    request.flush(page(customers));
    await settle();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Vinculada');
    expect(rows[1].textContent).toContain('Sin cuenta');
  });

  it('links each customer name to its detail page', async () => {
    expectList().flush(page(customers));
    await settle();

    const nameLink = fixture.nativeElement.querySelector('tbody tr td a.customers__name-link') as HTMLAnchorElement;
    expect(nameLink.textContent?.trim()).toBe('Carlos Pérez');
    expect(nameLink.getAttribute('href')).toBe('/admin/customers/c-1');
  });

  it('searches with the typed query, keeps it in the URL and goes back to the first page', async () => {
    expectList().flush(page(customers));
    await settle();

    fixture.componentInstance.query.set('ana');
    fixture.componentInstance.search();
    await settle();

    expect(router.url).toBe('/?q=ana');
    const request = expectList();
    expect(request.request.params.get('q')).toBe('ana');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(page([customers[1]]));
    await settle();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('moves between pages with the paginator and keeps the page in the URL', async () => {
    expectList().flush(page(customers, 60));
    await settle();
    expect(fixture.nativeElement.textContent).toContain('Página 1 de 3');

    (fixture.nativeElement.querySelector('button[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    await settle();

    expect(router.url).toBe('/?page=2');
    const request = expectList();
    expect(request.request.params.get('page')).toBe('2');
    request.flush(page(customers, 60, 2));
    await settle();
    expect(fixture.nativeElement.textContent).toContain('Página 2 de 3');
  });
});
