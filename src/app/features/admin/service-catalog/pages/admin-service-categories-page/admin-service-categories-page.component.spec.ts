import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { ServiceCategoryView } from '../../../../../core/models/service-catalog.models';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminServiceCategoriesPageComponent } from './admin-service-categories-page.component';

describe('AdminServiceCategoriesPageComponent', () => {
  let fixture: ComponentFixture<AdminServiceCategoriesPageComponent>;
  let component: AdminServiceCategoriesPageComponent;
  let httpMock: HttpTestingController;
  let confirmAnswer: boolean;
  const api = environment.defaultApiBaseUrl;

  function category(id: string, name: string, sortOrder: number, overrides: Partial<ServiceCategoryView> = {}): ServiceCategoryView {
    return {
      id, name, sortOrder, publicCode: `${id}code`, isActive: true, generalServiceCount: 0, activeGeneralServiceCount: 0,
      createdAt: '', updatedAt: null, ...overrides,
    };
  }

  const barberia = category('c-barber', 'Barbería', 0, { generalServiceCount: 2, activeGeneralServiceCount: 1, publicCode: 'barberia' });

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    confirmAnswer = true;
    await TestBed.configureTestingModule({
      imports: [AdminServiceCategoriesPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmModalService, useValue: { confirm: async () => confirmAnswer } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServiceCategoriesPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/admin/service-categories`).flush([barberia]);
    await settle();
  });

  afterEach(() => httpMock.verify());

  it('lists the categories with their general services and immutable code', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent!;

    expect(text).toContain('Categorías de servicio');
    expect(text).toContain('independientes de las categorías de productos');
    expect(text).toContain('Barbería');
    expect(text).toContain('1 activos');
    expect(text).toContain('de 2');
    expect(text).toContain('barberia');
  });

  it('creates a category with the next order and keeps the list sorted', async () => {
    component.openCreate();
    expect(component.form.getRawValue()).toEqual({ name: '', sortOrder: 1 });
    component.form.patchValue({ name: '  Cuidado facial ' });

    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/service-categories`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Cuidado facial', sortOrder: 1 });
    req.flush(category('c-face', 'Cuidado facial', 1));
    await saving;

    expect(component.isModalOpen()).toBe(false);
    expect(component.categories().map((item) => item.name)).toEqual(['Barbería', 'Cuidado facial']);
  });

  it('validates the form before calling the API', async () => {
    component.openCreate();
    component.form.patchValue({ name: 'x', sortOrder: -1 });

    await component.save();
    fixture.detectChanges();

    httpMock.expectNone(`${api}/admin/service-categories`);
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('El nombre debe tener entre 2 y 80 caracteres.');
    expect(text).toContain('Usa un número entero entre 0 y 9999.');
  });

  it('keeps the modal open with the message of a duplicated name', async () => {
    component.openEdit(barberia);
    component.form.patchValue({ name: 'Color' });

    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/service-categories/c-barber`);
    expect(req.request.method).toBe('PUT');
    req.flush({ detail: 'Ya existe una categoría de servicios con ese nombre.' }, { status: 409, statusText: 'Conflict' });
    await saving;

    expect(component.isModalOpen()).toBe(true);
    expect(component.formError()).toBe('Ya existe una categoría de servicios con ese nombre.');
  });

  it('shows why a category with active general services cannot be deactivated', async () => {
    const toggling = component.toggleActive(barberia);
    const req = httpMock.expectOne(`${api}/admin/service-categories/c-barber/status`);
    expect(req.request.body).toEqual({ isActive: false });
    req.flush({ detail: 'La categoría tiene 1 servicio(s) general(es) activo(s).' }, { status: 409, statusText: 'Conflict' });
    await toggling;

    expect(component.errorMessage()).toBe('La categoría tiene 1 servicio(s) general(es) activo(s).');
    expect(component.categories()[0].isActive).toBe(true);
  });

  it('deletes only after confirmation', async () => {
    confirmAnswer = false;
    await component.remove(barberia);
    httpMock.expectNone(`${api}/admin/service-categories/c-barber`);

    confirmAnswer = true;
    const removing = component.remove(barberia);
    await settle();
    httpMock.expectOne({ method: 'DELETE', url: `${api}/admin/service-categories/c-barber` }).flush(null);
    await removing;

    expect(component.categories()).toEqual([]);
  });
});
