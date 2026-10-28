import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerDetailView } from '../../../../../core/models/customer.models';
import { AdminCustomerUnlinkAccountModalComponent } from './admin-customer-unlink-account-modal.component';

describe('AdminCustomerUnlinkAccountModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerUnlinkAccountModalComponent>;
  let component: AdminCustomerUnlinkAccountModalComponent;
  let httpMock: HttpTestingController;

  const customer: CustomerDetailView = {
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
      linkedByName: 'Admin',
    },
    mergedIntoCustomerId: null,
    mergedIntoCustomerName: null,
    mergedAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: null,
    events: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerUnlinkAccountModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerUnlinkAccountModalComponent);
    component = fixture.componentInstance;
    component.customer = customer;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the linked account being removed', () => {
    expect(fixture.nativeElement.textContent).toContain('app@example.com');
  });

  it('requires a reason and an explicit confirmation before calling the API', async () => {
    component.confirmed.set(true);
    component.reason.set('  ');
    expect(component.canConfirm()).toBe(false);
    await component.confirm();
    httpMock.expectNone(`${environment.defaultApiBaseUrl}/admin/customers/c-1/unlink-account`);

    component.reason.set('Vinculada por error');
    component.confirmed.set(false);
    expect(component.canConfirm()).toBe(false);

    component.confirmed.set(true);
    expect(component.canConfirm()).toBe(true);

    const confirming = component.confirm();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/customers/c-1/unlink-account`);
    expect(req.request.body).toEqual({ reason: 'Vinculada por error' });
    req.flush({ ...customer, linkedAccount: null });
    await confirming;
  });
});
