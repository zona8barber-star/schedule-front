import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { LoyaltyRewardView } from '../../../../../core/models/loyalty-redemption.models';
import { AdminLoyaltyRewardsPageComponent } from './admin-loyalty-rewards-page.component';

describe('AdminLoyaltyRewardsPageComponent', () => {
  let fixture: ComponentFixture<AdminLoyaltyRewardsPageComponent>;
  let component: AdminLoyaltyRewardsPageComponent;
  let httpMock: HttpTestingController;
  const api = `${environment.defaultApiBaseUrl}/admin/loyalty/rewards`;

  const reward: LoyaltyRewardView = {
    id: 'r-1',
    name: 'Corte gratis',
    description: null,
    kind: 'Service',
    serviceId: 's-1',
    serviceName: 'Corte',
    pointsCost: 80,
    isActive: true,
    version: 5,
    createdAt: '2026-11-04T15:00:00Z',
    updatedAt: null,
    updatedByName: null,
  };

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushLoad(rewards: LoyaltyRewardView[]): void {
    httpMock.expectOne(api).flush(rewards);
    httpMock.expectOne(`${api}/service-options`).flush([
      { id: 's-1', name: 'Corte', isActive: true, generalServiceId: 'g-cut', generalServiceName: 'Corte clásico' },
    ]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoyaltyRewardsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoyaltyRewardsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function pagedChanges<T>(items: T[]) {
    return { items, page: 1, pageSize: 25, totalCount: items.length };
  }

  it('lists the catalog and creates an "other" reward without a service', async () => {
    flushLoad([reward]);
    await settle();
    expect(fixture.nativeElement.textContent).toContain('Corte gratis');
    expect(fixture.nativeElement.textContent).toContain('80 pts');

    component.form.setValue({ name: 'Gorra', description: '', kind: 'Other', serviceId: 's-1', pointsCost: 40, isActive: true });
    const saving = component.save();
    const request = httpMock.expectOne(api);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Gorra',
      description: null,
      kind: 'Other',
      serviceId: null,
      pointsCost: 40,
      isActive: true,
      version: null,
    });
    request.flush({ ...reward, id: 'r-2', name: 'Gorra', kind: 'Other', serviceId: null, serviceName: null, pointsCost: 40 });
    await settle();
    flushLoad([reward]);
    await saving;
    expect(component.successMessage()).toBe('Recompensa creada.');
  });

  it('requires the service of a service reward and edits with the version read', async () => {
    flushLoad([reward]);
    await settle();

    component.form.setValue({ name: 'Corte', description: '', kind: 'Service', serviceId: '', pointsCost: 80, isActive: true });
    await component.save();
    expect(component.errorMessage()).toContain('Elige el servicio');

    component.edit(reward);
    component.form.controls.pointsCost.setValue(90);
    const saving = component.save();
    const request = httpMock.expectOne(`${api}/r-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(expect.objectContaining({ serviceId: 's-1', pointsCost: 90, version: 5 }));
    request.flush({ ...reward, pointsCost: 90, version: 6 });
    await settle();
    flushLoad([{ ...reward, pointsCost: 90, version: 6 }]);
    await saving;
    expect(component.successMessage()).toContain('conservan sus condiciones');
  });

  it('shows the history of a reward', async () => {
    flushLoad([reward]);
    await settle();

    const loading = component.toggleHistory(reward);
    // The change log is paginated on the server.
    httpMock.expectOne(`${api}/r-1/changes?page=1&pageSize=25`).flush(pagedChanges([
      {
        id: 'h-1', changeType: 'Updated', changedAt: '2026-11-04T16:00:00Z', changedByName: 'Admin',
        previousName: 'Corte gratis', newName: 'Corte gratis', previousDescription: null, newDescription: null,
        previousKind: 'Service', newKind: 'Service', previousServiceName: 'Corte', newServiceName: 'Corte',
        previousPointsCost: 60, newPointsCost: 80, previousIsActive: true, newIsActive: true,
      },
    ]));
    await loading;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('coste 60 → 80 pts');
  });

  it('labels the service options "Servicio general · Tarifa"', async () => {
    flushLoad([reward]);
    await settle();

    expect(component.serviceOptionLabel(component.services()[0])).toBe('Corte clásico · Corte');
    expect(component.serviceOptionLabel({ id: 's-2', name: 'Barba', isActive: true })).toBe('Barba');
  });
});
