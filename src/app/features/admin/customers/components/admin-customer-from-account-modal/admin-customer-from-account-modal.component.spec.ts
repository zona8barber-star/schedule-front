import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import {
  CustomerAccountCandidate,
  CustomerDetailView,
  CustomerDuplicateCandidate,
} from '../../../../../core/models/customer.models';
import { AdminCustomerFromAccountModalComponent } from './admin-customer-from-account-modal.component';

describe('AdminCustomerFromAccountModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerFromAccountModalComponent>;
  let component: AdminCustomerFromAccountModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const withPhone: CustomerAccountCandidate = {
    userId: 'u-1',
    fullName: 'Carlos App',
    email: 'carlos@example.com',
    phoneNumber: '300 123 4567',
    createdAt: '2026-10-01T00:00:00Z',
  };
  const withoutPhone: CustomerAccountCandidate = { ...withPhone, userId: 'u-2', email: 'ana@example.com', phoneNumber: null };

  const freeProfile: CustomerDuplicateCandidate = {
    kind: 'customer',
    id: 'c-9',
    fullName: 'Carlos Mostrador',
    email: 'mostrador@example.com',
    phone: '3001234567',
    matchedOn: ['phone'],
    isLinked: false,
  };

  const result = { id: 'c-1' } as CustomerDetailView;

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  function expectDuplicatesRequest(userId: string) {
    return httpMock.expectOne(
      (request) => request.url === `${base}/duplicates` && request.params.get('excludeUserId') === userId,
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerFromAccountModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerFromAccountModalComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${base}/account-candidates`).flush([withPhone, withoutPhone]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prefills the account phone, checks duplicates and creates only after verification', async () => {
    const emitted: CustomerDetailView[] = [];
    component.saved.subscribe((value) => emitted.push(value));

    const selecting = component.select(withPhone);
    expectDuplicatesRequest('u-1').flush([]);
    await selecting;

    expect(component.phone()).toBe('300 123 4567');
    expect(component.canCreate()).toBe(false);

    component.identityVerified.set(true);
    expect(component.canCreate()).toBe(true);

    const creating = component.create();
    const req = httpMock.expectOne(`${base}/from-account`);
    expect(req.request.body).toEqual({ userId: 'u-1', phone: '300 123 4567', identityVerified: true });
    req.flush(result);
    await creating;

    expect(emitted).toEqual([result]);
  });

  it('requires a phone when the account has none', async () => {
    const selecting = component.select(withoutPhone);
    expectDuplicatesRequest('u-2').flush([]);
    await selecting;

    component.identityVerified.set(true);
    expect(component.phone()).toBe('');
    expect(component.canCreate()).toBe(false);

    component.onPhoneChange('3109998888');
    expect(component.canCreate()).toBe(true);
  });

  it('offers to link the account to an existing profile without an account instead of creating one', async () => {
    const emitted: CustomerDetailView[] = [];
    component.saved.subscribe((value) => emitted.push(value));

    const selecting = component.select(withPhone);
    expectDuplicatesRequest('u-1').flush([freeProfile]);
    await selecting;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Vincular a este perfil');
    expect(fixture.nativeElement.textContent).toContain('Crear perfil nuevo de todas formas');

    // Linking also requires the in-person verification.
    await component.linkToExisting(freeProfile);
    httpMock.expectNone(`${base}/c-9/link-account`);

    component.identityVerified.set(true);
    const linking = component.linkToExisting(freeProfile);
    const req = httpMock.expectOne(`${base}/c-9/link-account`);
    expect(req.request.body).toEqual({ userId: 'u-1', identityVerified: true });
    req.flush(result);
    await linking;

    expect(emitted).toEqual([result]);
  });

  it('re-checks duplicates when the phone changes before creating', async () => {
    const selecting = component.select(withPhone);
    expectDuplicatesRequest('u-1').flush([freeProfile]);
    await selecting;

    component.onPhoneChange('3209990000');
    expect(component.duplicates()).toEqual([]);
    component.identityVerified.set(true);

    const creating = component.create();
    expectDuplicatesRequest('u-1').flush([]);
    await flushMicrotasks();
    httpMock.expectOne(`${base}/from-account`).flush(result);
    await creating;
  });
});
