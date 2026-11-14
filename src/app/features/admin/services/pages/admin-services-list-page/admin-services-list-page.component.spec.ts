import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ServiceUsageView, ServiceView } from '../../../../../core/models/service.models';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminServicesListPageComponent } from './admin-services-list-page.component';

/** SONDA BUG-103: deleting a rate warns about the active plans and rewards that still use it. */
describe('AdminServicesListPageComponent deleting a rate', () => {
  const haircut = { id: 's-cut', name: 'Corte' } as ServiceView;
  let usage: ServiceUsageView;

  function setup() {
    const api = {
      list: () => of({ items: [], page: 1, pageSize: 20, totalCount: 0 }),
      getUsage: vi.fn(() => of(usage)),
      remove: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [AdminServicesListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminServicesApiService, useValue: api },
        { provide: AdminServiceCatalogApiService, useValue: { listGeneralServices: () => of([]) } },
      ],
    });
    const component = TestBed.createComponent(AdminServicesListPageComponent).componentInstance;
    return { api, component, modal: TestBed.inject(ConfirmModalService) };
  }

  async function flush(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it('names the active plans and rewards that stop being sellable', async () => {
    usage = { activePlans: ['Oro'], activeRewards: ['Corte gratis'] };
    const { component, modal } = setup();

    void component.deleteService(haircut);
    await flush();

    const warning = modal.state()!.options.warning!;
    expect(warning).toContain('«Oro» dejarán de poder venderse');
    expect(warning).toContain('«Corte gratis» dejarán de poder canjearse');
    expect(warning).toContain('Las membresías ya vendidas y los canjes ya aprobados la siguen usando');
    modal._resolve(false);
  });

  it('adds no warning when nothing uses the rate, and still deletes after confirming', async () => {
    usage = { activePlans: [], activeRewards: [] };
    const { api, component, modal } = setup();

    const deleting = component.deleteService(haircut);
    await flush();
    expect(modal.state()!.options.warning).toBeUndefined();
    modal._resolve(true);
    await deleting;

    expect(api.remove).toHaveBeenCalledWith('s-cut');
  });
});
