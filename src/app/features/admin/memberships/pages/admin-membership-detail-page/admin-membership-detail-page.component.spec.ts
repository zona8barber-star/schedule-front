import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerMembershipDetailView } from '../../../../../core/models/membership.models';
import { AdminMembershipDetailPageComponent } from './admin-membership-detail-page.component';

describe('AdminMembershipDetailPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const base: CustomerMembershipDetailView = {
    id: 'm-1',
    customerId: 'c-1',
    customerName: 'Carlos Pérez',
    originalCustomerId: 'c-1',
    originalCustomerName: 'Carlos Pérez',
    membershipPlanId: 'p-1',
    planName: 'Membresía Oro',
    planDescription: null,
    price: 250000,
    mode: 'Pool',
    terms: '• Personal e intransferible.',
    specificConditions: null,
    soldOn: '2026-10-28',
    startsOn: '2026-10-28',
    endsOn: '2099-01-25',
    status: 'PendingActivation',
    displayStatus: 'PendingActivation',
    activatedAt: null,
    activatedByName: null,
    annulledAt: null,
    annulledByName: null,
    annulmentReason: null,
    allowances: [
      {
        id: 'a-1',
        origin: 'Purchased',
        giftId: null,
        grantedQuantity: 10,
        consumedQuantity: 0,
        availableQuantity: 10,
        services: [
          { serviceId: 's-1', serviceName: 'Barba' },
          { serviceId: 's-2', serviceName: 'Corte' },
        ],
      },
    ],
    gifts: [
      { id: 'g-1', kind: 'Physical', condition: 'FirstPurchaseOfPlan', quantity: 1, serviceId: null, serviceName: null, description: 'Gorra', status: 'PendingDelivery', deliveryId: null, deliveredOn: null },
    ],
    income: null,
    events: [],
    consumptions: [],
    giftDeliveries: [],
    createdAt: '',
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function openPage(membership: CustomerMembershipDetailView): Promise<ComponentFixture<unknown>> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/memberships/:membershipId', component: AdminMembershipDetailPageComponent }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(`/admin/memberships/${membership.id}`);
    await flushMicrotasks();
    httpMock.expectOne(`${api}/admin/memberships/${membership.id}`).flush(membership);
    await navigation;
    await flushMicrotasks();
    harness.detectChanges();
    return harness.fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the sold copy: shared pool, gifts, terms and the pending actions', async () => {
    const fixture = await openPage(base);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Pendiente de activación');
    expect(text).toContain('Bolsa compartida');
    expect(text).toContain('10 de 10 disponibles');
    expect(text).toContain('Para cualquiera de: Barba, Corte');
    expect(text).toContain('1 × Gorra');
    expect(text).toContain('Pendiente de entrega');
    expect(text).toContain('Personal e intransferible');
    expect(text).toContain('Vincular ingreso');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).toContain('Activar');
    expect(buttons).toContain('Anular');
  });

  it('asks for confirmation and a reason to activate an expired membership', async () => {
    const fixture = await openPage({ ...base, endsOn: '2020-01-30' });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;

    await page.activate();
    fixture.detectChanges();

    expect(page.openModal()).toBe('activateExpired');
    expect(fixture.nativeElement.textContent).toContain('Activar membresía vencida');
    expect(fixture.nativeElement.textContent).toContain('Confirmo que quiero activarla');
  });

  it('annuls with the given reason and shows the blocked benefits', async () => {
    const fixture = await openPage({ ...base, status: 'Active', displayStatus: 'Active' });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;

    page.open('annul');
    const annulling = page.annul('Retracto legal');
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/annul`);
    expect(req.request.body).toEqual({ reason: 'Retracto legal' });
    req.flush({
      ...base,
      status: 'Annulled',
      displayStatus: 'Annulled',
      annulmentReason: 'Retracto legal',
      annulledAt: '2026-10-28T20:00:00Z',
      gifts: [{ ...base.gifts[0], status: 'NotDeliverable' }],
    });
    await annulling;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Anulada');
    expect(text).toContain('Retracto legal');
    expect(text).toContain('No entregable por anulación');
    expect(page.openModal()).toBeNull();
  });

  it('only demands a justification to unlink when the rest of the income would stop adding up', async () => {
    const peer = { membershipId: 'm-2', customerName: 'Carlos Pérez', planName: 'Oro', price: 250000, status: 'Active' as const };
    const own = { ...peer, membershipId: 'm-1' };
    await openPage({
      ...base,
      income: { incomeEntryId: 'i-1', amount: 500000, occurredOn: '2026-10-28', isDeleted: false, linkedMembershipsTotal: 500000, hasDiscrepancy: false, linkedMemberships: [own, peer] },
    });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;
    expect(page.unlinkNeedsJustification()).toBe(true);

    page.membership.update((membership) => ({
      ...membership!,
      income: { ...membership!.income!, linkedMemberships: [own], linkedMembershipsTotal: 250000, amount: 250000 },
    }));
    expect(page.unlinkNeedsJustification()).toBe(false);
  });

  const consumption = {
    id: 'c-1',
    serviceId: 's-1',
    serviceName: 'Barba',
    quantity: 3,
    serviceDate: '2026-10-20',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    registeredAt: '2026-10-28T20:00:00Z',
    registeredByName: 'Admin Principal',
    parts: [
      { allowanceId: 'a-2', origin: 'Gift' as const, quantity: 2 },
      { allowanceId: 'a-1', origin: 'Purchased' as const, quantity: 1 },
    ],
    reversal: null,
  };

  it('offers registering consumptions only on a started active membership', async () => {
    const pending = await openPage(base);
    let buttons = [...pending.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).not.toContain('Registrar consumo');
    httpMock.verify();
    TestBed.resetTestingModule();

    const active = await openPage({ ...base, status: 'Active', displayStatus: 'Active' });
    buttons = [...active.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).toContain('Registrar consumo');
    expect(active.nativeElement.textContent).toContain('Todavía no se registran consumos');
  });

  it('lists consumptions with the gifted and purchased split and the paid/gifted totals', async () => {
    const fixture = await openPage({
      ...base,
      status: 'Active',
      displayStatus: 'Active',
      allowances: [
        { ...base.allowances[0], consumedQuantity: 1, availableQuantity: 9 },
        { id: 'a-2', origin: 'Gift', giftId: 'g-9', grantedQuantity: 2, consumedQuantity: 2, availableQuantity: 0, services: [{ serviceId: 's-1', serviceName: 'Barba' }] },
      ],
      consumptions: [consumption],
    });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Pagados: 9 de 10');
    expect(text).toContain('Regalados: 0 de 2');
    expect(text).toContain('1 usado(s)');
    expect(text).toContain('3 × Barba');
    expect(text).toContain('2 regalado(s) + 1 pagado(s)');
    expect(text).toContain('Profesional: Alex');
    expect(text).toContain('Admin Principal');
  });

  it('reverses a consumption of an annulled membership with a reason, keeping it annulled', async () => {
    const fixture = await openPage({
      ...base,
      status: 'Annulled',
      displayStatus: 'Annulled',
      annulmentReason: 'Retracto',
      annulledAt: '2026-10-28T21:00:00Z',
      consumptions: [consumption],
    });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;
    expect(fixture.nativeElement.textContent).toContain('Bloqueados por anulación');

    page.openReverse(page.membership()!.consumptions[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('La membresía sigue anulada');

    const reversing = page.reverse('Registrado por error');
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/consumptions/c-1/reverse`);
    expect(req.request.body).toEqual({ reason: 'Registrado por error' });
    req.flush({
      ...page.membership()!,
      consumptions: [{ ...consumption, reversal: { reason: 'Registrado por error', performedAt: '2026-10-28T22:00:00Z', performedByName: 'Admin Principal' } }],
    });
    await reversing;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Motivo: Registrado por error');
    expect(text).toContain('Anulada');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).not.toContain('Revertir');
  });

  const delivery = {
    id: 'd-1',
    giftId: 'g-1',
    giftDescription: 'Gorra',
    quantity: 1,
    deliveredOn: '2026-10-25',
    registeredAt: '2026-10-28T20:00:00Z',
    registeredByName: 'Admin Principal',
    reversal: null,
  };
  const deliveredGift = { ...base.gifts[0], status: 'Delivered' as const, deliveryId: 'd-1', deliveredOn: '2026-10-25' };

  it('offers delivering a pending physical gift only on an active membership', async () => {
    const pending = await openPage(base);
    let buttons = [...pending.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).not.toContain('Registrar entrega');
    httpMock.verify();
    TestBed.resetTestingModule();

    const active = await openPage({ ...base, status: 'Active', displayStatus: 'Active' });
    buttons = [...active.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).toContain('Registrar entrega');
    expect(buttons).not.toContain('Revertir entrega');
  });

  it('shows a delivered gift with its date and history, and reverses it with a reason', async () => {
    const fixture = await openPage({
      ...base,
      status: 'Active',
      displayStatus: 'Active',
      gifts: [deliveredGift],
      giftDeliveries: [delivery],
    });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Entregado el 2026-10-25');
    expect(text).toContain('Historial de entregas');
    expect(text).toContain('Admin Principal');

    page.openDeliveryReversal(page.membership()!.gifts[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('volverá a quedar pendiente de entrega');

    const reversing = page.reverseDelivery('Se entregó al cliente equivocado');
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/gifts/g-1/deliveries/d-1/reverse`);
    expect(req.request.body).toEqual({ reason: 'Se entregó al cliente equivocado' });
    req.flush({
      ...page.membership()!,
      gifts: [{ ...base.gifts[0], status: 'PendingDelivery' }],
      giftDeliveries: [{ ...delivery, reversal: { reason: 'Se entregó al cliente equivocado', performedAt: '2026-10-28T21:00:00Z', performedByName: 'Admin Principal' } }],
    });
    await reversing;
    fixture.detectChanges();

    const after = fixture.nativeElement.textContent as string;
    expect(after).toContain('Motivo: Se entregó al cliente equivocado');
    expect(after).toContain('Pendiente de entrega');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).toContain('Registrar entrega');
  });

  it('keeps delivered gifts delivered on an annulled membership, allows reversing them and never offers new deliveries', async () => {
    const fixture = await openPage({
      ...base,
      status: 'Annulled',
      displayStatus: 'Annulled',
      annulmentReason: 'Retracto',
      annulledAt: '2026-10-28T21:00:00Z',
      gifts: [deliveredGift, { ...base.gifts[0], id: 'g-2', description: 'Llavero', status: 'NotDeliverable' }],
      giftDeliveries: [delivery],
    });
    const page = harness.routeDebugElement!.componentInstance as AdminMembershipDetailPageComponent;
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Entregado el 2026-10-25');
    expect(text).toContain('No entregable por anulación');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(buttons).not.toContain('Registrar entrega');
    expect(buttons).toContain('Revertir entrega');

    page.openDeliveryReversal(page.membership()!.gifts[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('el obsequio quedará no entregable');
  });
});
