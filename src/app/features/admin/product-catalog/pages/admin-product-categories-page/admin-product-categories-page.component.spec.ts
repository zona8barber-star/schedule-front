import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { RuntimeConfigService } from '../../../../../core/config/runtime-config.service';
import { ProductCategoryView } from '../../../../../core/models/product-catalog.models';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminProductCategoriesPageComponent } from './admin-product-categories-page.component';

describe('AdminProductCategoriesPageComponent', () => {
  let fixture: ComponentFixture<AdminProductCategoriesPageComponent>;
  let component: AdminProductCategoriesPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  function category(id: string, name: string, overrides: Partial<ProductCategoryView> = {}): ProductCategoryView {
    return {
      id, name, sortOrder: 0, publicCode: `${id}code`, isActive: true, productCount: 2, activeProductCount: 1,
      createdAt: '', updatedAt: null, ...overrides,
    };
  }

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function create(publicSiteUrl?: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminProductCategoriesPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmModalService, useValue: { confirm: async () => true } },
      ],
    }).compileComponents();

    if (publicSiteUrl !== undefined) {
      const config = TestBed.inject(RuntimeConfigService);
      vi.spyOn(config, 'config').mockReturnValue({ ...config.config(), publicSiteUrl });
    }

    fixture = TestBed.createComponent(AdminProductCategoriesPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/admin/product-categories`).flush([
      category('c-wax', 'Ceras', { publicCode: 'ceras001' }),
      category('c-off', 'Pausada', { isActive: false, sortOrder: 3 }),
    ]);
    await settle();
  }

  afterEach(() => httpMock.verify());

  it('lists the categories with their product counts and read-only public code', async () => {
    await create();
    const text = (fixture.nativeElement as HTMLElement).textContent!;

    expect(text).toContain('Ceras');
    expect(text).toContain('1 activos');
    expect(text).toContain('de 2');
    expect(text).toContain('ceras001');
    expect(text).toContain('Inactiva');
  });

  it('shows the public catalog link from the current origin when no public site is configured', async () => {
    await create();

    expect(component.publicCatalogUrl()).toBe(`${window.location.origin}/productos`);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid="public-catalog-link"] a')!;
    expect(link.textContent).toContain('/productos');
  });

  it('builds the public catalog link from publicSiteUrl when configured', async () => {
    await create('https://zona-8.vercel.app/');

    expect(component.publicCatalogUrl()).toBe('https://zona-8.vercel.app/productos');
  });

  it('creates a category with the next order, trimmed', async () => {
    await create();
    component.openCreate();
    expect(component.form.controls.sortOrder.value).toBe(4);

    component.form.patchValue({ name: '  Aceites ' });
    const saving = component.save();
    const req = httpMock.expectOne(`${api}/admin/product-categories`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Aceites', sortOrder: 4 });
    req.flush(category('c-oil', 'Aceites', { sortOrder: 4 }));
    await saving;

    expect(component.isModalOpen()).toBe(false);
    expect(component.categories().map((item) => item.id)).toEqual(['c-wax', 'c-off', 'c-oil']);
  });

  it('shows why a category with active products cannot be deactivated', async () => {
    await create();
    const toggling = component.toggleActive(component.categories()[0]);
    httpMock.expectOne(`${api}/admin/product-categories/c-wax/status`).flush(
      { detail: 'La categoría tiene 1 producto(s) activo(s).' },
      { status: 409, statusText: 'Conflict' },
    );
    await toggling;

    expect(component.errorMessage()).toBe('La categoría tiene 1 producto(s) activo(s).');
  });
});
