import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { AdminMembershipPlansListPageComponent } from './admin-membership-plans-list-page.component';

describe('AdminMembershipPlansListPageComponent', () => {
  let fixture: ComponentFixture<AdminMembershipPlansListPageComponent>;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/membership-plans`;

  const plans: MembershipPlanView[] = [
    {
      id: 'p-1',
      name: 'Oro',
      description: null,
      price: 250000,
      mode: 'Pool',
      poolQuantity: 10,
      defaultDurationDays: 90,
      terms: 'T',
      specificConditions: null,
      isActive: true,
      services: [
        { serviceId: 's-1', serviceName: 'Corte', serviceBasePrice: 25000, serviceIsActive: true, quantity: null },
        { serviceId: 's-2', serviceName: 'Barba', serviceBasePrice: 15000, serviceIsActive: true, quantity: null },
      ],
      giftRules: [],
      createdAt: '',
      updatedAt: null,
    },
    {
      id: 'p-2',
      name: 'Plata',
      description: null,
      price: 180000,
      mode: 'PerService',
      poolQuantity: null,
      defaultDurationDays: 60,
      terms: 'T',
      specificConditions: null,
      isActive: false,
      services: [
        { serviceId: 's-1', serviceName: 'Corte', serviceBasePrice: 25000, serviceIsActive: true, quantity: 8 },
        { serviceId: 's-2', serviceName: 'Barba', serviceBasePrice: 15000, serviceIsActive: true, quantity: 4 },
      ],
      giftRules: [
        { id: 'g-1', kind: 'Physical', serviceId: null, serviceName: null, description: 'Gorra', quantity: 1, condition: 'EveryPurchase' },
      ],
      createdAt: '',
      updatedAt: null,
    },
  ];

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipPlansListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipPlansListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(base).flush(plans);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('summarises each mode, the services and the status', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Bolsa común: 10 servicios');
    expect(rows[0].textContent).toContain('Corte, Barba');
    expect(rows[1].textContent).toContain('Por servicio: 12 en total');
    expect(rows[1].textContent).toContain('8 × Corte, 4 × Barba');
    expect(rows[1].textContent).toContain('Inactivo');
  });

  it('opens the editor from the plan name', () => {
    (fixture.nativeElement.querySelector('.plans__name-btn') as HTMLButtonElement).click();

    expect(fixture.componentInstance.isModalOpen()).toBe(true);
    expect(fixture.componentInstance.editingPlanId()).toBe('p-1');
    // The modal loads the services catalog and the plan; not under test here.
    httpMock.match(() => true).forEach((request) => request.flush([]));
  });

  it('toggles the active status', async () => {
    const toggling = fixture.componentInstance.toggleActive(plans[1]);
    const req = httpMock.expectOne(`${base}/p-2/status`);
    expect(req.request.body).toEqual({ isActive: true });
    req.flush({ ...plans[1], isActive: true });
    await toggling;

    expect(fixture.componentInstance.plans().find((plan) => plan.id === 'p-2')?.isActive).toBe(true);
  });

  it('deletes after confirmation', async () => {
    (fixture.componentInstance as any)['confirmModal'].confirm = async () => true;

    const deleting = fixture.componentInstance.deletePlan(plans[0]);
    await flushMicrotasks();
    const req = httpMock.expectOne(`${base}/p-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await deleting;

    expect(fixture.componentInstance.plans().map((plan) => plan.id)).toEqual(['p-2']);
  });
});
