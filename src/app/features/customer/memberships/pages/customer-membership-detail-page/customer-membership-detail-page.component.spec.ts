import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../../../environments/environment';
import { MyMembershipView } from '../../../../../core/models/my-membership.models';
import { CustomerMembershipDetailPageComponent } from './customer-membership-detail-page.component';

describe('CustomerMembershipDetailPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const base: MyMembershipView = {
    id: 'm-1',
    planName: 'Membresía Oro',
    planDescription: 'Cortes y barba del mes',
    price: 250000,
    mode: 'Pool',
    displayStatus: 'Active',
    soldOn: '2026-10-01',
    startsOn: '2026-10-01',
    endsOn: '2026-10-30',
    purchasedByName: null,
    balances: [
      { origin: 'Purchased', services: ['Barba', 'Corte'], grantedQuantity: 10, consumedQuantity: 1, availableQuantity: 9 },
      { origin: 'Gift', services: ['Barba'], grantedQuantity: 2, consumedQuantity: 2, availableQuantity: 0 },
    ],
    gifts: [
      { kind: 'Service', description: 'Barba', quantity: 2, status: 'Granted', deliveredOn: null },
      { kind: 'Physical', description: 'Gorra', quantity: 1, status: 'Delivered', deliveredOn: '2026-10-05' },
      { kind: 'Physical', description: 'Llavero', quantity: 1, status: 'PendingDelivery', deliveredOn: null },
    ],
    consumptions: [
      {
        serviceName: 'Barba',
        quantity: 3,
        serviceDate: '2026-10-10',
        parts: [
          { origin: 'Gift', quantity: 2 },
          { origin: 'Purchased', quantity: 1 },
        ],
        isReversed: false,
        reversedAt: null,
      },
      { serviceName: 'Corte', quantity: 2, serviceDate: '2026-10-08', parts: [{ origin: 'Purchased', quantity: 2 }], isReversed: true, reversedAt: '2026-10-09T15:00:00Z' },
    ],
    terms: '• Personal e intransferible.',
    specificConditions: 'Solo de lunes a jueves',
  };

  async function openPage(membership: MyMembershipView): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'customer/memberships/:membershipId', component: CustomerMembershipDetailPageComponent }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(`/customer/memberships/${membership.id}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock.expectOne(`${api}/customer/memberships/${membership.id}`).flush(membership);
    await navigation;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the paid and gifted balances, the included services and the purchase conditions', async () => {
    const text = (await openPage(base)).textContent ?? '';

    expect(text).toContain('Vigente');
    expect(text).toContain('Disponibles hasta el 2026-10-30');
    expect(text).toContain('9 disponibles de 10 · 1 usados');
    expect(text).toContain('0 disponibles de 2 · 2 usados');
    expect(text).toContain('10 × Barba, Corte');
    expect(text).toMatch(/Precio de compra\$\s250[.,]000/); // the separator depends on the test locale
    expect(text).toContain('Personal e intransferible');
    expect(text).toContain('Solo de lunes a jueves');
  });

  it('lists consumptions with their split and marks the corrected ones', async () => {
    const element = await openPage(base);
    const text = element.textContent ?? '';

    expect(text).toContain('3 × Barba');
    expect(text).toContain('2 regalado(s) + 1 pagado(s)');
    expect(text).toContain('Corregido');
    expect(text).toContain('volvieron a tu saldo');
    expect(element.querySelectorAll('.my-memberships__reversed').length).toBe(1);
  });

  it('shows service and physical gifts with their delivery state', async () => {
    const text = (await openPage(base)).textContent ?? '';

    expect(text).toContain('Incluido en tu saldo');
    expect(text).toMatch(/Entregado\s+el 2026-10-05/);
    expect(text).toContain('Pendiente de entrega');
  });

  it('marks an annulled membership as blocked, with gifts not deliverable, and names a merged original holder', async () => {
    const element = await openPage({
      ...base,
      displayStatus: 'Annulled',
      purchasedByName: 'Carlos P.',
      gifts: [
        { kind: 'Service', description: 'Barba', quantity: 2, status: 'Blocked', deliveredOn: null },
        { kind: 'Physical', description: 'Llavero', quantity: 1, status: 'NotDeliverable', deliveredOn: null },
      ],
    });
    const text = element.textContent ?? '';

    expect(element.querySelector('.my-memberships__notice--blocked')?.textContent).toContain('la membresía fue anulada');
    expect(text).toContain('Bloqueado por anulación');
    expect(text).toContain('No entregable por anulación');
    expect(text).toContain('Comprada como');
    expect(text).toContain('Carlos P.');
  });

  it('shows the API message when the membership is not the customer’s', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'customer/memberships/:membershipId', component: CustomerMembershipDetailPageComponent }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/customer/memberships/ajena');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock
      .expectOne(`${api}/customer/memberships/ajena`)
      .flush({ title: 'No encontrado', detail: 'La membresía no existe.', status: 404 }, { status: 404, statusText: 'Not Found' });
    await navigation;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();

    const text = (harness.fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('La membresía no existe.');
    expect(text).not.toContain('Saldos');
  });
});
