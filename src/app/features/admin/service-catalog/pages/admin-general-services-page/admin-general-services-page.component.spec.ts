import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { GeneralServiceView, ServiceCategoryView } from '../../../../../core/models/service-catalog.models';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminGeneralServicesPageComponent } from './admin-general-services-page.component';

describe('AdminGeneralServicesPageComponent', () => {
  let fixture: ComponentFixture<AdminGeneralServicesPageComponent>;
  let component: AdminGeneralServicesPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  function category(id: string, name: string, isActive = true): ServiceCategoryView {
    return {
      id, name, sortOrder: 0, publicCode: `${id}code`, isActive, generalServiceCount: 1, activeGeneralServiceCount: 1,
      createdAt: '', updatedAt: null,
    };
  }

  function general(id: string, name: string, categoryId: string, categoryName: string, overrides: Partial<GeneralServiceView> = {}): GeneralServiceView {
    return {
      id, categoryId, categoryName, categoryIsActive: true, name, description: null, sortOrder: 0, publicCode: `${id}code`,
      isActive: true, rateCount: 0, activeRateCount: 0, createdAt: '', updatedAt: null, ...overrides,
    };
  }

  const categories = [category('c-barber', 'Barbería'), category('c-face', 'Cuidado facial'), category('c-off', 'Pausada', false)];
  const services = [
    general('g-cut', 'Corte', 'c-barber', 'Barbería', { rateCount: 3, activeRateCount: 2, publicCode: 'corte' }),
    general('g-face', 'Limpieza facial', 'c-face', 'Cuidado facial', { description: 'Limpieza profunda' }),
  ];

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushLists(nextServices = services): void {
    httpMock.expectOne(`${api}/admin/service-categories`).flush(categories);
    httpMock.expectOne(`${api}/admin/general-services`).flush(nextServices);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminGeneralServicesPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmModalService, useValue: { confirm: async () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminGeneralServicesPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushLists();
    await settle();
  });

  afterEach(() => httpMock.verify());

  it('lists the general services with their category, rates and code', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent!;

    expect(text).toContain('Corte');
    expect(text).toContain('Barbería');
    expect(text).toContain('2 activas');
    expect(text).toContain('de 3');
    expect(text).toContain('corte');
    expect(text).toContain('Limpieza profunda');
  });

  it('filters by category', async () => {
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('[data-testid="category-filter"]')!;
    select.value = 'c-face';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(component.visibleServices().map((service) => service.id)).toEqual(['g-face']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-general-service]').length).toBe(1);
  });

  it('creates a general service in the filtered category, offering only active categories', async () => {
    component.categoryFilter.set('c-face');
    component.openCreate();

    expect(component.form.controls.categoryId.value).toBe('c-face');
    expect(component.categoryOptions().map((option) => option.id)).toEqual(['c-barber', 'c-face']);

    component.form.patchValue({ name: ' Mascarilla ', description: '   ', sortOrder: 2 });
    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/general-services`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ categoryId: 'c-face', name: 'Mascarilla', description: null, sortOrder: 2 });
    req.flush(general('g-mask', 'Mascarilla', 'c-face', 'Cuidado facial'));
    await settle();
    flushLists([...services, general('g-mask', 'Mascarilla', 'c-face', 'Cuidado facial')]);
    await saving;

    expect(component.isModalOpen()).toBe(false);
    expect(component.services().map((service) => service.id)).toContain('g-mask');
  });

  it('keeps an inactive current category selectable when editing, and can move the service', async () => {
    const paused = general('g-old', 'Tinte', 'c-off', 'Pausada', { categoryIsActive: false });
    component.openEdit(paused);
    fixture.detectChanges();

    expect(component.categoryOptions().map((option) => option.id)).toEqual(['c-barber', 'c-face', 'c-off']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pausada (inactiva)');

    component.form.patchValue({ categoryId: 'c-barber' });
    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/general-services/g-old`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.categoryId).toBe('c-barber');
    req.flush({ ...paused, categoryId: 'c-barber', categoryName: 'Barbería', categoryIsActive: true });
    await settle();
    flushLists();
    await saving;
  });

  it('shows why a general service with active rates cannot be deactivated', async () => {
    const toggling = component.toggleActive(services[0]);
    httpMock.expectOne(`${api}/admin/general-services/g-cut/status`).flush(
      { detail: 'El servicio general tiene 2 tarifa(s) activa(s).' },
      { status: 409, statusText: 'Conflict' },
    );
    await toggling;

    expect(component.errorMessage()).toBe('El servicio general tiene 2 tarifa(s) activa(s).');
  });
});
