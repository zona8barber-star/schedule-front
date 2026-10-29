import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { ServiceView } from '../../../../../core/models/service.models';
import { DEFAULT_MEMBERSHIP_TERMS } from '../../membership-plan-defaults';
import { AdminMembershipPlanFormModalComponent } from './admin-membership-plan-form-modal.component';

describe('AdminMembershipPlanFormModalComponent', () => {
  let fixture: ComponentFixture<AdminMembershipPlanFormModalComponent>;
  let component: AdminMembershipPlanFormModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const catalog: ServiceView[] = [
    { id: 's-cut', name: 'Corte', basePrice: 25000, businessPercentage: 30, isActive: true, createdAt: '', updatedAt: null },
    { id: 's-beard', name: 'Barba', basePrice: 15000, businessPercentage: 30, isActive: true, createdAt: '', updatedAt: null },
    { id: 's-old', name: 'Tinte', basePrice: 40000, businessPercentage: 30, isActive: false, createdAt: '', updatedAt: null },
  ];

  const existingPlan: MembershipPlanView = {
    id: 'p-1',
    name: 'Plata',
    description: null,
    price: 180000,
    mode: 'PerService',
    poolQuantity: null,
    defaultDurationDays: 60,
    terms: 'Términos guardados',
    specificConditions: null,
    isActive: true,
    services: [
      { serviceId: 's-cut', serviceName: 'Corte', serviceBasePrice: 25000, serviceIsActive: true, quantity: 8 },
      { serviceId: 's-old', serviceName: 'Tinte', serviceBasePrice: 40000, serviceIsActive: false, quantity: 2 },
    ],
    giftRules: [
      {
        id: 'g-1',
        kind: 'Physical',
        serviceId: null,
        serviceName: null,
        description: 'Gorra',
        quantity: 1,
        condition: 'FirstPurchaseOfPlan',
      },
    ],
    createdAt: '',
    updatedAt: null,
  };

  /** ngOnInit awaits Promise.all over two requests; each await hop needs the microtask queue drained. */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(planId: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipPlanFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipPlanFormModalComponent);
    component = fixture.componentInstance;
    component.planId = planId;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/services`).flush(catalog);
    if (planId) {
      httpMock.expectOne(`${api}/admin/membership-plans/${planId}`).flush(existingPlan);
    }
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('preloads the default terms and starts as a pool plan', async () => {
    await open(null);

    expect(component.form.controls.terms.value).toBe(DEFAULT_MEMBERSHIP_TERMS);
    expect(component.isPool()).toBe(true);
    // Inactive catalog services cannot be added.
    expect(component.addableServices().map((service) => service.id)).toEqual(['s-beard', 's-cut']);
  });

  it('sends a pool plan with one shared quantity and no per-service quantities', async () => {
    await open(null);
    const emitted: MembershipPlanView[] = [];
    component.saved.subscribe((value) => emitted.push(value));

    component.form.patchValue({ name: 'Oro', price: 250000, poolQuantity: 10, defaultDurationDays: 90 });
    component.addService('s-cut');
    component.addService('s-beard');
    component.addGift('Service');
    component.addGift('Physical');
    component.giftsArray.at(1).patchValue({ description: 'Cera para cabello' });

    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/admin/membership-plans`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Oro',
      description: null,
      price: 250000,
      mode: 'Pool',
      poolQuantity: 10,
      defaultDurationDays: 90,
      terms: DEFAULT_MEMBERSHIP_TERMS,
      specificConditions: null,
      services: [
        { serviceId: 's-cut', quantity: null },
        { serviceId: 's-beard', quantity: null },
      ],
      giftRules: [
        { id: null, kind: 'Service', serviceId: 's-cut', description: null, quantity: 1, condition: 'EveryPurchase' },
        { id: null, kind: 'Physical', serviceId: null, description: 'Cera para cabello', quantity: 1, condition: 'EveryPurchase' },
      ],
    });
    req.flush(existingPlan);
    await submitting;

    expect(emitted.length).toBe(1);
  });

  it('picks the gift condition with toggle buttons, independently for each gift', async () => {
    await open(null);
    component.addService('s-cut');
    component.addGift('Service');
    component.addGift('Physical');
    fixture.detectChanges();

    const gifts = fixture.nativeElement.querySelectorAll('.plan-modal__gift') as NodeListOf<HTMLElement>;
    const firstGiftButtons = gifts[0].querySelectorAll('.plan-modal__condition-btn') as NodeListOf<HTMLButtonElement>;
    expect(firstGiftButtons[1].textContent?.trim()).toBe('Solo en la primera compra de este tipo');
    expect(firstGiftButtons[0].getAttribute('aria-pressed')).toBe('true');

    firstGiftButtons[1].click();
    fixture.detectChanges();

    expect(component.giftsArray.at(0).controls['condition'].value).toBe('FirstPurchaseOfPlan');
    expect(component.giftsArray.at(1).controls['condition'].value).toBe('EveryPurchase');
    expect(firstGiftButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(firstGiftButtons[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to per-service quantities and blocks zero or negative values', async () => {
    await open(null);
    component.form.patchValue({ name: 'Plata' });
    component.addService('s-cut');
    component.form.controls.mode.setValue('PerService');

    expect(component.form.controls.poolQuantity.disabled).toBe(true);
    const quantity = component.servicesArray.at(0).controls['quantity'];
    expect(quantity.value).toBe(1);

    quantity.setValue(0);
    await component.submit();
    httpMock.expectNone(`${api}/admin/membership-plans`);

    quantity.setValue(-2);
    await component.submit();
    httpMock.expectNone(`${api}/admin/membership-plans`);

    quantity.setValue(8);
    expect(component.buildRequest().poolQuantity).toBeNull();
    expect(component.buildRequest().services).toEqual([{ serviceId: 's-cut', quantity: 8 }]);
  });

  it('does not save a service gift whose service was removed from the plan', async () => {
    await open(null);
    component.form.patchValue({ name: 'Oro' });
    component.addService('s-cut');
    component.addService('s-beard');
    component.addGift('Service');
    component.giftsArray.at(0).patchValue({ serviceId: 's-beard' });

    component.removeService(1);
    await component.submit();
    fixture.detectChanges();

    httpMock.expectNone(`${api}/admin/membership-plans`);
    expect(component.planProblems()).toContain('Hay obsequios de servicio que no están incluidos en la membresía.');
    expect(fixture.nativeElement.textContent).toContain('no están incluidos en la membresía');
  });

  it('requires at least one service and a description for physical gifts', async () => {
    await open(null);
    component.form.patchValue({ name: 'Oro' });
    component.addGift('Physical');

    await component.submit();

    httpMock.expectNone(`${api}/admin/membership-plans`);
    expect(component.planProblems()).toContain('Incluye al menos un servicio.');
    expect(component.giftsArray.at(0).controls['description'].invalid).toBe(true);
  });

  it('loads an existing plan, keeps inactive services it already has and sends rule ids back', async () => {
    await open('p-1');

    expect(component.form.controls.mode.value).toBe('PerService');
    expect(component.form.controls.terms.value).toBe('Términos guardados');
    expect(component.isServiceInactive('s-old')).toBe(true);

    const request = component.buildRequest();
    expect(request.services).toEqual([
      { serviceId: 's-cut', quantity: 8 },
      { serviceId: 's-old', quantity: 2 },
    ]);
    expect(request.giftRules[0].id).toBe('g-1');

    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/admin/membership-plans/p-1`);
    expect(req.request.method).toBe('PUT');
    req.flush(existingPlan);
    await submitting;
  });
});
