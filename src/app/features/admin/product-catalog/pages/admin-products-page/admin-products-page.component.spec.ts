import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { ProductCategoryView, ProductView } from '../../../../../core/models/product-catalog.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminProductsPageComponent } from './admin-products-page.component';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';

describe('AdminProductsPageComponent', () => {
  let fixture: ComponentFixture<AdminProductsPageComponent>;
  let component: AdminProductsPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  function category(id: string, name: string, isActive = true): ProductCategoryView {
    return {
      id, name, sortOrder: 0, publicCode: `${id}code`, isActive, productCount: 1, activeProductCount: 1,
      createdAt: '', updatedAt: null,
    };
  }

  function product(id: string, name: string, categoryId: string, categoryName: string, overrides: Partial<ProductView> = {}): ProductView {
    return {
      id, categoryId, categoryName, categoryIsActive: true, name, description: null, price: 35000,
      imageMediaAssetId: null, imageUrl: null, sortOrder: 0, publicCode: `${id}code`, isActive: true,
      createdAt: '', updatedAt: null, ...overrides,
    };
  }

  const categories = [category('c-wax', 'Ceras'), category('c-oil', 'Aceites'), category('c-off', 'Pausada', false)];
  const products = [
    product('p-wax', 'Cera mate', 'c-wax', 'Ceras', { publicCode: 'cera0001', description: 'Acabado natural' }),
    product('p-oil', 'Aceite', 'c-oil', 'Aceites', { price: 20000, imageUrl: 'https://cdn.example.com/oil.jpg', imageMediaAssetId: 'm-1' }),
  ];

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushLists(nextProducts = products, expectedParams: Record<string, string> = {}): void {
    httpMock.expectOne(`${api}/admin/product-categories`).flush(categories);
    const request = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/products` && candidate.method === 'GET');
    for (const [key, value] of Object.entries(expectedParams)) {
      expect(request.request.params.get(key)).toBe(value);
    }
    request.flush({ items: nextProducts, page: 1, pageSize: 20, totalCount: nextProducts.length });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductsPageComponent],
      providers: [
        // Saving money values asks for confirmation (BUG-080 decision); these specs cover the save itself.
        { provide: MoneyConfirmationService, useValue: { confirm: () => Promise.resolve(true) } },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmModalService, useValue: { confirm: async () => true } },
        { provide: AuthService, useValue: { refreshAccessToken: () => Promise.resolve('fresh-token') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProductsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushLists();
    await settle();
  });

  afterEach(() => httpMock.verify());

  it('lists the products with category, price, image and public code', () => {
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent!.replace(/\s/g, ' ');

    expect(text).toContain('Cera mate');
    expect(text).toContain('Acabado natural');
    expect(text).toMatch(/\$ ?35\.000/);
    expect(text).toContain('cera0001');
    expect(element.querySelector<HTMLImageElement>('img.catalog__thumb')!.src).toBe('https://cdn.example.com/oil.jpg');
  });

  it('filters by category on the server and keeps the filter in the URL', async () => {
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('[data-testid="category-filter"]')!;
    select.value = 'c-oil';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/?categoryId=c-oil');
    flushLists([products[1]], { categoryId: 'c-oil', page: '1' });
    await settle();

    expect(component.visibleProducts().map((item) => item.id)).toEqual(['p-oil']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-product]').length).toBe(1);
  });

  it('creates a product with its price in the filtered category, offering only active categories', async () => {
    component.categoryFilter.set('c-oil');
    component.openCreate();
    fixture.detectChanges();

    expect(component.form.controls.categoryId.value).toBe('c-oil');
    expect(component.categoryOptions().map((option) => option.id)).toEqual(['c-wax', 'c-oil']);
    // No image before the product exists.
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="product-image-upload"]')).toBeNull();

    component.form.patchValue({ name: ' Aceite de barba ', description: '  ', price: 42000, sortOrder: 2 });
    const saving = component.save();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/products`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ categoryId: 'c-oil', name: 'Aceite de barba', description: null, price: 42000, sortOrder: 2 });
    req.flush(product('p-new', 'Aceite de barba', 'c-oil', 'Aceites'));
    await settle();
    flushLists([...products, product('p-new', 'Aceite de barba', 'c-oil', 'Aceites')]);
    await saving;

    expect(component.isModalOpen()).toBe(false);
    expect(component.products().map((item) => item.id)).toContain('p-new');
  });

  it('refuses a negative or fractional price before calling the API', () => {
    component.openCreate();
    component.form.patchValue({ name: 'Cera', price: -1 });
    void component.save();
    component.form.patchValue({ price: 10.5 });
    void component.save();

    expect(component.form.controls.price.invalid).toBe(true);
    httpMock.expectNone(`${api}/admin/products`);
  });

  it('uploads an image for the product being edited and shows it', async () => {
    component.openEdit(products[0]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="product-image-upload"]')!.textContent).toContain('Subir imagen');

    const file = new File([new Uint8Array([1, 2, 3])], 'cera.png', { type: 'image/png' });
    const input = { files: [file], value: 'cera.png' } as unknown as HTMLInputElement;
    const uploading = component.onImageSelected({ target: input } as unknown as Event);
    await settle();

    const req = httpMock.expectOne(`${api}/admin/products/p-wax/image`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...products[0], imageMediaAssetId: 'm-2', imageUrl: 'https://cdn.example.com/cera.jpg' });
    await uploading;
    fixture.detectChanges();

    expect(component.editing()?.imageUrl).toBe('https://cdn.example.com/cera.jpg');
    expect(component.products().find((item) => item.id === 'p-wax')?.imageUrl).toBe('https://cdn.example.com/cera.jpg');
    expect(component.imagePreviewUrl()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('[data-testid="product-image-preview"]')!.src)
      .toBe('https://cdn.example.com/cera.jpg');
  });

  it('refuses an image over 10 MB without uploading it', async () => {
    component.openEdit(products[0]);
    const big = { size: 10_485_761, name: 'huge.jpg', type: 'image/jpeg' } as File;
    await component.onImageSelected({ target: { files: [big], value: '' } } as unknown as Event);

    expect(component.imageError()).toBe('La imagen no puede superar 10 MB.');
    httpMock.expectNone(`${api}/admin/products/p-wax/image`);
  });

  it('removes the image after confirming', async () => {
    component.openEdit(products[1]);
    const removing = component.removeImage();
    await settle();

    const req = httpMock.expectOne(`${api}/admin/products/p-oil/image`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ...products[1], imageMediaAssetId: null, imageUrl: null });
    await removing;

    expect(component.editing()?.imageUrl).toBeNull();
  });

  it('explains why a product cannot be reactivated in an inactive category', async () => {
    const inactive = product('p-old', 'Gel', 'c-off', 'Pausada', { isActive: false, categoryIsActive: false });
    const toggling = component.toggleActive(inactive);
    httpMock.expectOne(`${api}/admin/products/p-old/status`).flush(
      { detail: 'La categoría del producto está inactiva.' },
      { status: 409, statusText: 'Conflict' },
    );
    await toggling;

    expect(component.errorMessage()).toBe('La categoría del producto está inactiva.');
  });
});
