import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { CustomerListItem } from '../../../../../core/models/customer.models';
import { AdminCustomersListPageComponent } from './admin-customers-list-page.component';

describe('AdminCustomersListPageComponent', () => {
  let fixture: ComponentFixture<AdminCustomersListPageComponent>;
  let httpMock: HttpTestingController;
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomersListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomersListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists customers with their account status', async () => {
    httpMock.expectOne(base).flush(customers);
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Vinculada');
    expect(rows[1].textContent).toContain('Sin cuenta');
  });

  it('links each customer name to its detail page', async () => {
    httpMock.expectOne(base).flush(customers);
    await fixture.whenStable();
    fixture.detectChanges();

    const nameLink = fixture.nativeElement.querySelector('tbody tr td a.customers__name-link') as HTMLAnchorElement;
    expect(nameLink.textContent?.trim()).toBe('Carlos Pérez');
    expect(nameLink.getAttribute('href')).toBe('/admin/customers/c-1');
  });

  it('searches with the typed query', async () => {
    httpMock.expectOne(base).flush(customers);
    await fixture.whenStable();

    fixture.componentInstance.query.set('ana');
    fixture.componentInstance.search();
    httpMock.expectOne(`${base}?q=ana`).flush([customers[1]]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });
});
