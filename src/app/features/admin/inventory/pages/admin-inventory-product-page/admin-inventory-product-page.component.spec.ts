import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { environment } from '../../../../../../environments/environment';
import { InventoryItemView, InventoryMovementView } from '../../../../../core/models/inventory.models';
import { AdminInventoryProductPageComponent } from './admin-inventory-product-page.component';

describe('AdminInventoryProductPageComponent', () => {
  const api = environment.defaultApiBaseUrl;
  const productId = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
  let fixture: ComponentFixture<AdminInventoryProductPageComponent>;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const item: InventoryItemView = {
    productId, name: 'Cera mate', categoryId: 'c', categoryName: 'Ceras', isActive: true, price: 35000, onHand: 4,
    averageUnitCost: 21000, minStock: 2, isLowStock: false, unitProfit: 14000, marginPercent: 40, stockValue: 84000,
    updatedAt: null,
  };

  function movement(id: string, overrides: Partial<InventoryMovementView>): InventoryMovementView {
    return {
      id, productId, type: 'Receipt', quantity: 5, unitCost: 20000, onHandAfter: 5, averageUnitCostAfter: 20000,
      occurredOn: '2026-11-15', reason: null, supplier: null, reference: null, expenseEntryId: null,
      performedByName: 'Ana Admin', createdAt: '2026-11-15T15:00:00Z', ...overrides,
    };
  }

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function create(id: string): Promise<void> {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [AdminInventoryProductPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ productId: id }) }, queryParamMap: queryParams },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminInventoryProductPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('shows the stock card with signed quantities, costs and details', async () => {
    await create(productId);
    httpMock.expectOne(`${api}/admin/inventory/${productId}`).flush(item);
    httpMock.expectOne((request) => request.url === `${api}/admin/inventory/${productId}/movements`).flush({
      items: [
        movement('m-2', { type: 'AdjustmentOut', quantity: -1, unitCost: 20000, onHandAfter: 4, reason: 'Frasco roto' }),
        movement('m-1', { supplier: 'Distribuidora', reference: 'F-1', expenseEntryId: 'e-1' }),
      ],
      page: 1,
      pageSize: 25,
      totalCount: 2,
    });
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Movimientos de Cera mate');
    const adjustment = element.querySelector('[data-movement="m-2"]')!.textContent!.replace(/\s+/g, ' ');
    expect(adjustment).toContain('Ajuste: resta');
    expect(adjustment).toContain('-1');
    expect(adjustment).toContain('Frasco roto');
    const receipt = element.querySelector('[data-movement="m-1"]')!.textContent!.replace(/\s+/g, ' ');
    expect(receipt).toContain('Entrada de mercancía');
    expect(receipt).toContain('+5');
    expect(receipt).toContain('Distribuidora · Ref. F-1 · Gasto de compra creado');
  });

  it('shows the not-found state for an id that is not a GUID, without calling the API', async () => {
    await create('no-existe');
    await settle();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No encontramos este producto');
    httpMock.expectNone(() => true);
  });
});
