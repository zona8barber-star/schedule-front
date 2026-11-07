import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import {
  CustomerDetailView,
  CustomerListItem,
  CustomerMergePreview,
} from '../../../../../core/models/customer.models';
import { AdminCustomerMergeModalComponent } from './admin-customer-merge-modal.component';

describe('AdminCustomerMergeModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerMergeModalComponent>;
  let component: AdminCustomerMergeModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const target: CustomerDetailView = {
    id: 'c-1',
    fullName: 'Carlos Pérez',
    phone: '3001234567',
    email: 'carlos@example.com',
    linkedAccount: null,
    mergedIntoCustomerId: null,
    mergedIntoCustomerName: null,
    mergedAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: null,
    events: [],
  };

  const targetItem: CustomerListItem = {
    id: 'c-1',
    fullName: 'Carlos Pérez',
    phone: '3001234567',
    email: 'carlos@example.com',
    linkedAccount: null,
    createdAt: '2026-10-01T10:00:00Z',
  };

  const sourceItem: CustomerListItem = { ...targetItem, id: 'c-2', fullName: 'Carlos P.', email: 'p@example.com' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerMergeModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerMergeModalComponent);
    component = fixture.componentInstance;
    component.customer = target;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function searchAndChoose(preview: CustomerMergePreview): Promise<void> {
    component.query.set('carlos');
    const searching = component.search();
    httpMock.expectOne(`${base}?q=carlos`).flush({ items: [targetItem, sourceItem], page: 1, pageSize: 20, totalCount: 2 });
    await searching;

    // The surviving profile is never offered as the duplicate.
    expect(component.results().map((item) => item.id)).toEqual(['c-2']);

    const choosing = component.choose(sourceItem);
    httpMock.expectOne(`${base}/c-1/merge-preview?sourceCustomerId=c-2`).flush(preview);
    await choosing;
    fixture.detectChanges();
  }

  it('cannot merge when the preview reports a blocking reason', async () => {
    await searchAndChoose({
      target: targetItem,
      source: sourceItem,
      canMerge: false,
      blockingReasons: ['Ambos clientes tienen cuentas vinculadas distintas.'],
      warnings: [],
      accountToTransfer: null,
      loyalty: null,
      previewToken: 'tok-1',
    });

    component.confirmed.set(true);
    expect(component.canConfirm()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('cuentas vinculadas distintas');
  });

  it('merges after explicit confirmation when the preview allows it', async () => {
    const merged: CustomerDetailView[] = [];
    component.merged.subscribe((value) => merged.push(value));

    await searchAndChoose({
      target: targetItem,
      source: sourceItem,
      canMerge: true,
      blockingReasons: [],
      warnings: ['Se conservan los datos del cliente destino.'],
      accountToTransfer: null,
      loyalty: null,
      previewToken: 'tok-1',
    });

    expect(component.canConfirm()).toBe(false);
    component.confirmed.set(true);
    expect(component.canConfirm()).toBe(true);

    const confirming = component.confirm();
    const req = httpMock.expectOne(`${base}/c-1/merge`);
    expect(req.request.body).toEqual({ sourceCustomerId: 'c-2', previewToken: 'tok-1' });
    req.flush(target);
    await confirming;

    expect(merged).toEqual([target]);
  });

  it('shows the points that move with their original expiry and the result after settling debts', async () => {
    await searchAndChoose({
      target: targetItem,
      source: sourceItem,
      canMerge: true,
      blockingReasons: [],
      warnings: [],
      accountToTransfer: null,
      loyalty: {
        sourceAvailablePoints: 20,
        sourceDebtPoints: 15,
        targetAvailablePoints: 30,
        targetDebtPoints: 0,
        resultAvailablePoints: 35,
        resultDebtPoints: 0,
        sourceExpiredPointsNotMoved: 5,
        lotsToTransfer: [{ lotId: 'l-1', sourceLabel: 'Ajuste manual', points: 20, expiresOn: '2026-11-12', expiresSoon: true }],
      },
      previewToken: 'tok-2',
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('35 disponibles · 0 de deuda');
    expect(text).toContain('20 pts · Ajuste manual');
    expect(text).toContain('(vence pronto)');
    expect(text).toContain('5 punto(s) vencido(s) no se traspasan');
  });
});
