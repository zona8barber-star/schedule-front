import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerAccountCandidate, CustomerDetailView } from '../../../../../core/models/customer.models';
import { AdminCustomerLinkAccountModalComponent } from './admin-customer-link-account-modal.component';

describe('AdminCustomerLinkAccountModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerLinkAccountModalComponent>;
  let component: AdminCustomerLinkAccountModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const customer: CustomerDetailView = {
    id: 'c-1',
    fullName: 'Carlos Pérez',
    phone: '3001234567',
    email: 'carlos@example.com',
    linkedAccount: null,
    mergedIntoCustomerId: null,
    mergedIntoCustomerName: null,
    mergedAt: null,
    createdAt: '2026-10-28T10:00:00Z',
    updatedAt: null,
    events: [],
  };

  const candidates: CustomerAccountCandidate[] = [
    { userId: 'u-1', fullName: 'Carlos App', email: 'carlos@example.com', phoneNumber: null, createdAt: '2026-10-01T00:00:00Z' },
    { userId: 'u-2', fullName: 'Otra Cuenta', email: 'otra@example.com', phoneNumber: null, createdAt: '2026-10-01T00:00:00Z' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerLinkAccountModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerLinkAccountModalComponent);
    component = fixture.componentInstance;
    component.customer = customer;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${base}/account-candidates?q=carlos@example.com`).flush(candidates);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists candidates and cannot confirm until an account is chosen and identity is verified', async () => {
    expect(fixture.nativeElement.textContent).toContain('Carlos App');
    expect(component.canConfirm()).toBe(false);

    component.select('u-1');
    expect(component.canConfirm()).toBe(false);

    component.identityVerified.set(true);
    expect(component.canConfirm()).toBe(true);

    const confirming = component.confirm();
    const req = httpMock.expectOne(`${base}/c-1/link-account`);
    expect(req.request.body).toEqual({ userId: 'u-1', identityVerified: true });
    req.flush({ ...customer, linkedAccount: null });
    await confirming;
  });

  it('resets the verification when a different account is chosen', () => {
    component.select('u-1');
    component.identityVerified.set(true);

    component.select('u-2');

    expect(component.identityVerified()).toBe(false);
    expect(component.canConfirm()).toBe(false);
  });
});
