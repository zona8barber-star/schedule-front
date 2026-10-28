import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerDetailView } from '../../../../../core/models/customer.models';
import { AdminCustomerDetailPageComponent } from './admin-customer-detail-page.component';

describe('AdminCustomerDetailPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const linkedCustomer: CustomerDetailView = {
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
      linkedByName: 'Admin Principal',
    },
    mergedIntoCustomerId: null,
    mergedIntoCustomerName: null,
    mergedAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: null,
    events: [
      {
        id: 'e-2',
        type: 'AccountLinked',
        performedAt: '2026-10-20T10:00:00Z',
        performedByName: 'Admin Principal',
        userId: 'u-1',
        userEmail: 'app@example.com',
        relatedCustomerId: null,
        relatedCustomerName: null,
        reason: null,
      },
    ],
  };

  const mergedCustomer: CustomerDetailView = {
    ...linkedCustomer,
    id: 'c-2',
    fullName: 'Carlos P.',
    linkedAccount: null,
    mergedIntoCustomerId: 'c-1',
    mergedIntoCustomerName: 'Carlos Pérez',
    mergedAt: '2026-10-25T10:00:00Z',
    events: [],
  };

  async function openPage(customer: CustomerDetailView): Promise<ComponentFixture<unknown>> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/customers/:customerId', component: AdminCustomerDetailPageComponent }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(`/admin/customers/${customer.id}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock.expectOne(`${base}/${customer.id}`).flush(customer);
    await navigation;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();
    return harness.fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the linked account, the unlink action and the history', async () => {
    const fixture = await openPage(linkedCustomer);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Carlos Pérez');
    expect(text).toContain('app@example.com');
    expect(text).toContain('Desvincular cuenta');
    expect(text).toContain('Cuenta vinculada');
    expect(text).toContain('Fusionar perfil duplicado');
  });

  it('shows a merged profile as read-only history with a link to the surviving profile', async () => {
    const fixture = await openPage(mergedCustomer);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Este perfil fue fusionado en');
    expect(text).toContain('Carlos Pérez');
    expect(text).not.toContain('Editar datos');
    expect(text).not.toContain('Vincular cuenta');
    expect(text).not.toContain('Fusionar perfil duplicado');
    // The date format already ends in "p. m." / "a. m.", so the sentence must not add a second period.
    expect(text).not.toMatch(/\.\s*\.\s*Se conserva/);
    // A merged profile never says it "does not have an account yet".
    expect(text).not.toContain('aún no tiene una cuenta');
    expect(text).toContain('No tenía una cuenta de la app vinculada al momento de la fusión.');
  });

  it('says which account moved to the surviving profile when the merge transferred one', async () => {
    const fixture = await openPage({
      ...mergedCustomer,
      events: [
        {
          id: 'e-9',
          type: 'MergedInto',
          performedAt: '2026-10-25T10:00:00Z',
          performedByName: 'Admin Principal',
          userId: 'u-1',
          userEmail: 'app@example.com',
          relatedCustomerId: 'c-1',
          relatedCustomerName: 'Carlos Pérez',
          reason: null,
        },
      ],
    });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Al fusionarse, la cuenta app@example.com pasó a');
    expect(text).not.toContain('No tenía una cuenta');
  });
});
