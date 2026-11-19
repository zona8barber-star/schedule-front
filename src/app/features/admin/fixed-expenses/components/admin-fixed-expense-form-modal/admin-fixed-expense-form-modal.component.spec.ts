import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminFixedExpensesApiService } from '../../../../../core/services/admin-fixed-expenses-api.service';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';
import { AdminFixedExpenseFormModalComponent } from './admin-fixed-expense-form-modal.component';

// SONDA BUG-169 (ADR-0021 L6): the default amount of a fixed expense is confirmed like every other money value.
describe('AdminFixedExpenseFormModalComponent', () => {
  let component: AdminFixedExpenseFormModalComponent;
  let confirm: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;

  async function setUp(confirmed: boolean): Promise<void> {
    confirm = vi.fn(() => Promise.resolve(confirmed));
    create = vi.fn(() => of({ id: 'f-1', name: 'Arriendo', defaultAmount: 1500000, isActive: true }));
    await TestBed.configureTestingModule({
      imports: [AdminFixedExpenseFormModalComponent],
      providers: [
        { provide: MoneyConfirmationService, useValue: { confirm } },
        { provide: AdminFixedExpensesApiService, useValue: { create, update: vi.fn(), getById: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminFixedExpenseFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('confirms the default amount before saving', async () => {
    await setUp(true);
    component.form.setValue({ name: ' Arriendo ', defaultAmount: 1500000 });

    await component.submit();

    expect(confirm).toHaveBeenCalledWith({ action: 'Crear el gasto fijo', amount: 1500000, detail: 'Arriendo' });
    expect(create).toHaveBeenCalledWith({ name: 'Arriendo', defaultAmount: 1500000 });
  });

  it('does not save when the confirmation is declined', async () => {
    await setUp(false);
    component.form.setValue({ name: 'Arriendo', defaultAmount: 15000000 });

    await component.submit();

    expect(confirm).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('saves a fixed expense without a default amount without asking (there is no amount to confirm)', async () => {
    await setUp(true);
    component.form.setValue({ name: 'Servicios', defaultAmount: null });

    await component.submit();

    expect(confirm).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({ name: 'Servicios', defaultAmount: null });
  });
});
