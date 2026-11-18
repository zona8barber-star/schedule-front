import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { InventoryItemView, InventorySummaryView } from '../../../../../core/models/inventory.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';
import { AdminInventoryPageComponent } from './admin-inventory-page.component';

describe('AdminInventoryPageComponent', () => {
  let fixture: ComponentFixture<AdminInventoryPageComponent>;
  let component: AdminInventoryPageComponent;
  let httpMock: HttpTestingController;
  let granted: PermissionCode[];
  let confirmMoney: ReturnType<typeof vi.fn>;
  const api = environment.defaultApiBaseUrl;

  function item(productId: string, name: string, overrides: Partial<InventoryItemView> = {}): InventoryItemView {
    return {
      productId, name, categoryId: 'c-wax', categoryName: 'Ceras', isActive: true, price: 35000, onHand: 0,
      averageUnitCost: null, minStock: null, isLowStock: false, unitProfit: null, marginPercent: null, stockValue: null,
      updatedAt: null, ...overrides,
    };
  }

  const summary: InventorySummaryView = { lowStockCount: 1, negativeStockCount: 0, stockValue: 315000, productsWithoutCost: 1 };
  const items = [
    item('p-wax', 'Cera mate', {
      onHand: 2, averageUnitCost: 21000, minStock: 3, isLowStock: true, unitProfit: 14000, marginPercent: 40, stockValue: 42000,
    }),
    item('p-new', 'Shampoo'),
  ];

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushLoad(nextItems = items, expectedParams: Record<string, string> = {}): void {
    httpMock.expectOne(`${api}/admin/inventory/summary`).flush(summary);
    const request = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/inventory` && candidate.method === 'GET');
    for (const [key, value] of Object.entries(expectedParams)) {
      expect(request.request.params.get(key)).toBe(value);
    }
    request.flush({ items: nextItems, page: 1, pageSize: 25, totalCount: nextItems.length });
  }

  async function create(permissions: PermissionCode[]): Promise<void> {
    granted = permissions;
    fixture = TestBed.createComponent(AdminInventoryPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushLoad();
    await settle();
  }

  function row(productId: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-product="${productId}"]`) as HTMLElement;
  }

  function buttons(productId: string): string[] {
    return Array.from(row(productId).querySelectorAll('.catalog__actions button, .catalog__actions a')).map(
      (element) => element.textContent!.trim(),
    );
  }

  beforeEach(async () => {
    confirmMoney = vi.fn(() => Promise.resolve(true));
    await TestBed.configureTestingModule({
      imports: [AdminInventoryPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MoneyConfirmationService, useValue: { confirm: confirmMoney } },
        { provide: AuthService, useValue: { hasPermission: (code: PermissionCode) => granted.includes(code) } },
      ],
    }).compileComponents();
  });

  afterEach(() => httpMock.verify());

  it('shows stock, average cost, unit profit, the low stock alert and the totals', async () => {
    await create([PERMISSION_CODES.inventoryView]);
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('1 producto tiene stock bajo.');
    expect(text).toContain('$ 315.000');
    expect(row('p-wax').textContent).toContain('Stock bajo');
    expect(row('p-wax').textContent).toContain('$ 21.000');
    expect(row('p-wax').textContent).toContain('$ 14.000');
    expect(row('p-wax').textContent).toContain('40 %');
    // A product that never had a receipt shows no cost and no profit instead of made-up numbers.
    expect(row('p-new').textContent).toContain('Sin costo');
    // Only reading: no receipts, adjustments or minimum stock.
    expect(buttons('p-wax')).toEqual(['Movimientos']);
  });

  it('shows the rotation of each product: daily average, available stock and coverage days', async () => {
    await create([PERMISSION_CODES.inventoryView]);
    void component.loadSales('2026-11-01', '2026-11-10');
    httpMock.expectOne((request) => request.url.endsWith('/admin/inventory/sales')).flush({
      from: '2026-11-01',
      to: '2026-11-10',
      items: [
        { productId: 'p-1', name: 'Cera mate', units: 20, revenue: 700000, cost: 400000, profit: 300000, marginPercent: 42.86,
          unitsWithoutCost: 0, available: 5, dailyUnits: 2, coverageDays: 2.5, isLowStock: true },
        { productId: 'p-2', name: 'Peine', units: 0, revenue: 0, cost: 0, profit: 0, marginPercent: null,
          unitsWithoutCost: 0, available: 12, dailyUnits: null, coverageDays: null, isLowStock: false },
      ],
      units: 20,
      revenue: 700000,
      cost: 400000,
      profit: 300000,
      unitsWithoutCost: 0,
    });
    await settle();

    const sold = (fixture.nativeElement as HTMLElement).querySelector('[data-sales-product="p-1"]')!;
    expect(sold.querySelector('[data-testid="sales-daily"]')!.textContent!.trim()).toBe('2');
    expect(sold.querySelector('[data-testid="sales-available"]')!.textContent).toContain('Stock bajo');
    expect(sold.querySelector('[data-testid="sales-coverage"]')!.textContent!.trim()).toBe('2,5 días');
    const unsold = (fixture.nativeElement as HTMLElement).querySelector('[data-sales-product="p-2"]')!;
    expect(unsold.querySelector('[data-testid="sales-daily"]')!.textContent!.trim()).toBe('—');
    expect(unsold.querySelector('[data-testid="sales-coverage"]')!.textContent!.trim()).toBe('Sin ventas');
  });

  it('offers each action only with its permission', async () => {
    await create([PERMISSION_CODES.inventoryReceive]);
    expect(buttons('p-wax')).toEqual(['Entrada', 'Stock mínimo', 'Movimientos']);
  });

  it('records a receipt with the purchase expense after confirming the total, reusing the key on a retry', async () => {
    await create([PERMISSION_CODES.inventoryReceive, PERMISSION_CODES.inventoryAdjust]);
    component.openReceipt(items[0]);
    component.receiptForm.patchValue({ quantity: 5, unitCost: 23000, supplier: ' Distribuidora ', createExpense: true });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Total de la compra: $ 115.000');

    const first = component.saveReceipt();
    await settle();
    expect(confirmMoney).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Registrar la entrada y el gasto de compra', amount: 115000 }),
    );
    const failed = httpMock.expectOne(`${api}/admin/inventory/p-wax/receipts`);
    expect(failed.request.body).toMatchObject({ quantity: 5, unitCost: 23000, supplier: 'Distribuidora', createExpense: true });
    const key = failed.request.body.idempotencyKey;
    failed.flush({ title: 'Error', status: 500 }, { status: 500, statusText: 'Server Error' });
    await first;

    const retry = component.saveReceipt();
    await settle();
    const stored = httpMock.expectOne(`${api}/admin/inventory/p-wax/receipts`);
    expect(stored.request.body.idempotencyKey).toBe(key);
    stored.flush({ item: items[0], movement: {} });
    await settle();
    flushLoad();
    await retry;
    await settle();

    expect(component.modal()).toBeNull();
    expect(component.successMessage()).toBe('Entrada registrada: 5 unidades de «Cera mate».');
  });

  it('does not send an adjustment that would leave the stock below zero', async () => {
    await create([PERMISSION_CODES.inventoryAdjust]);
    component.openAdjust(items[0]);
    component.adjustForm.setValue({ direction: 'Out', quantity: 3, reason: 'Frascos rotos' });

    await component.saveAdjust();

    expect(component.formError()).toBe('Solo puedes restar hasta 2 unidades: la existencia no puede quedar por debajo de cero.');
    httpMock.expectNone(`${api}/admin/inventory/p-wax/adjustments`);
  });

  it('records an adjustment with its reason', async () => {
    await create([PERMISSION_CODES.inventoryAdjust]);
    component.openAdjust(items[0]);
    component.adjustForm.setValue({ direction: 'In', quantity: 1, reason: '  Conteo físico ' });

    const saving = component.saveAdjust();
    const request = httpMock.expectOne(`${api}/admin/inventory/p-wax/adjustments`);
    expect(request.request.body).toMatchObject({ direction: 'In', quantity: 1, reason: 'Conteo físico' });
    request.flush({ item: items[0], movement: {} });
    await settle();
    flushLoad();
    await saving;

    expect(component.successMessage()).toBe('Ajuste registrado en «Cera mate».');
  });

  it('sets and clears the minimum stock', async () => {
    await create([PERMISSION_CODES.inventoryReceive]);
    component.openMinStock(items[1]);
    component.minStockForm.setValue({ minStock: 4 });

    const saving = component.saveMinStock();
    const request = httpMock.expectOne(`${api}/admin/inventory/p-new/min-stock`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ minStock: 4 });
    request.flush(items[1]);
    await settle();
    flushLoad();
    await saving;

    expect(component.successMessage()).toBe('Stock mínimo de «Shampoo»: 4.');
  });

  // SONDA BUG-136: a failed load is the common error state, never «Todavía no hay productos».
  it('shows the error state with a retry instead of an empty catalog when the inventory cannot be loaded', async () => {
    granted = [PERMISSION_CODES.inventoryView];
    fixture = TestBed.createComponent(AdminInventoryPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/admin/inventory/summary`).flush({ title: 'Error' }, { status: 500, statusText: 'Server Error' });
    httpMock.match((candidate) => candidate.url === `${api}/admin/inventory`).forEach((request) => request.flush({ items: [], page: 1, pageSize: 25, totalCount: 0 }));
    await settle();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Todavía no hay productos');

    (element.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement).click();
    flushLoad();
    await settle();
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
  });

});
