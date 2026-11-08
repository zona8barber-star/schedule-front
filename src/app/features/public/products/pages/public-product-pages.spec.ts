import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PublicProductCategoriesPageComponent } from './public-product-categories-page/public-product-categories-page.component';
import { PublicProductCategoryPageComponent } from './public-product-category-page/public-product-category-page.component';
import { PublicProductDetailPageComponent } from './public-product-detail-page/public-product-detail-page.component';

/** ADR-0016 B6: categories → products → detail, anonymous, with a friendly "No disponible" for dead links. */
describe('Public product catalog pages', () => {
  const api = environment.defaultApiBaseUrl;
  let httpMock: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function render<T>(component: Type<T>, routeParams: Record<string, string> = {}): Promise<ComponentFixture<T>> {
    params = new BehaviorSubject(convertToParamMap(routeParams));
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function text(fixture: ComponentFixture<unknown>): string {
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  afterEach(() => httpMock.verify());

  describe('/productos', () => {
    it('lists the categories, each linking to its stable code', async () => {
      const fixture = await render(PublicProductCategoriesPageComponent);
      httpMock.expectOne(`${api}/public/product-categories`).flush([
        { code: 'aceite01', name: 'Aceites', productCount: 1 },
        { code: 'ceras001', name: 'Ceras', productCount: 3 },
      ]);
      await settle(fixture);

      expect(text(fixture)).toContain('1 producto');
      expect(text(fixture)).toContain('3 productos');
      const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-category-code="ceras001"]')!;
      expect(link.getAttribute('href')).toBe('/productos/ceras001');
    });

    it('says when nothing is published yet, and offers a retry on errors', async () => {
      const fixture = await render(PublicProductCategoriesPageComponent);
      httpMock.expectOne(`${api}/public/product-categories`).flush('boom', { status: 500, statusText: 'Server Error' });
      await settle(fixture);
      expect(text(fixture)).toContain('No pudimos cargar el catálogo');

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
      httpMock.expectOne(`${api}/public/product-categories`).flush([]);
      await settle(fixture);
      expect(text(fixture)).toContain('Aún no hay productos publicados');
    });
  });

  describe('/productos/:categoryCode', () => {
    it('shows the products with their price and image', async () => {
      const fixture = await render(PublicProductCategoryPageComponent, { categoryCode: 'ceras001' });
      httpMock.expectOne(`${api}/public/product-categories/ceras001`).flush({
        code: 'ceras001',
        name: 'Ceras',
        products: [
          { code: 'cera0001', name: 'Cera mate', description: 'Acabado natural', price: 35000, imageUrl: 'https://cdn.example.com/c.jpg' },
          { code: 'gel00001', name: 'Gel', description: null, price: 18000, imageUrl: null },
        ],
      });
      await settle(fixture);

      const element = fixture.nativeElement as HTMLElement;
      expect(text(fixture)).toContain('Ceras');
      expect(text(fixture)).toMatch(/\$ ?35\.000/);
      expect(text(fixture)).toMatch(/\$ ?18\.000/);
      expect(element.querySelector<HTMLImageElement>('img')!.src).toBe('https://cdn.example.com/c.jpg');
      expect(element.querySelector('[data-product-code="cera0001"]')!.getAttribute('href')).toBe('/productos/ceras001/cera0001');
    });

    it('shows "No disponible" for an inactive or unknown category instead of failing', async () => {
      const fixture = await render(PublicProductCategoryPageComponent, { categoryCode: 'viejo001' });
      httpMock.expectOne(`${api}/public/product-categories/viejo001`).flush(
        { detail: 'El elemento no está disponible.' },
        { status: 404, statusText: 'Not Found' },
      );
      await settle(fixture);

      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="not-available"]')).not.toBeNull();
      expect(text(fixture)).toContain('No disponible');
    });

    it('follows the route when moving to another category', async () => {
      const fixture = await render(PublicProductCategoryPageComponent, { categoryCode: 'ceras001' });
      httpMock.expectOne(`${api}/public/product-categories/ceras001`).flush({ code: 'ceras001', name: 'Ceras', products: [] });
      await settle(fixture);
      expect(text(fixture)).toContain('Sin productos por ahora');

      params.next(convertToParamMap({ categoryCode: 'aceite01' }));
      httpMock.expectOne(`${api}/public/product-categories/aceite01`).flush({ code: 'aceite01', name: 'Aceites', products: [] });
      await settle(fixture);
      expect(text(fixture)).toContain('Aceites');
    });
  });

  describe('/productos/:categoryCode/:productCode', () => {
    it('shows the detail and price, resolving the product by its own code', async () => {
      // The link still names the category the product had when it was printed.
      const fixture = await render(PublicProductDetailPageComponent, { categoryCode: 'antigua1', productCode: 'cera0001' });
      httpMock.expectOne(`${api}/public/products/cera0001`).flush({
        code: 'cera0001',
        name: 'Cera mate',
        description: 'Acabado natural',
        price: 35000,
        imageUrl: null,
        categoryCode: 'ceras001',
        categoryName: 'Ceras',
      });
      await settle(fixture);

      const element = fixture.nativeElement as HTMLElement;
      expect(text(fixture)).toContain('Cera mate');
      expect(text(fixture)).toContain('Acabado natural');
      expect(element.querySelector('[data-testid="product-price"]')!.textContent!.replace(/\s/g, ' ')).toMatch(/\$ ?35\.000/);
      // The breadcrumb uses the current category.
      expect(element.querySelector('a[href="/productos/ceras001"]')).not.toBeNull();
    });

    it('shows "No disponible" for an inactive product', async () => {
      const fixture = await render(PublicProductDetailPageComponent, { categoryCode: 'ceras001', productCode: 'retir001' });
      httpMock.expectOne(`${api}/public/products/retir001`).flush(null, { status: 404, statusText: 'Not Found' });
      await settle(fixture);

      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="not-available"]')).not.toBeNull();
    });
  });
});
