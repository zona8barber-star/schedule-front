import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ExpenseEntryView } from '../../../../../core/models/expense.models';
import { FixedExpenseView } from '../../../../../core/models/fixed-expense.models';
import { AdminExpensesApiService } from '../../../../../core/services/admin-expenses-api.service';
import { AdminFixedExpensesApiService } from '../../../../../core/services/admin-fixed-expenses-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

@Component({
  selector: 'app-admin-expense-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-expense-form-modal.component.html',
  styleUrl: './admin-expense-form-modal.component.scss',
})
export class AdminExpenseFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly expensesApi = inject(AdminExpensesApiService);
  private readonly fixedExpensesApi = inject(AdminFixedExpensesApiService);

  @Input() entry: ExpenseEntryView | null = null;
  @Input() defaultDate = '';
  @Output() readonly saved = new EventEmitter<ExpenseEntryView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly fixedExpenses = signal<FixedExpenseView[]>([]);
  readonly isSaving = signal(false);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isSaving() || this.isLoading());

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    amount: [0, [Validators.required, Validators.min(0), integerValidator]],
    occurredOn: ['', [Validators.required]],
  });

  get isEditing(): boolean {
    return this.entry !== null;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      const all = await firstValueFrom(this.fixedExpensesApi.list());
      this.fixedExpenses.set(all.filter((f) => f.isActive));

      if (this.entry) {
        this.form.patchValue({
          name: this.entry.name,
          amount: this.entry.amount,
          occurredOn: this.entry.occurredOn,
        });
      } else {
        this.form.patchValue({ occurredOn: this.defaultDate });
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  onNameChange(name: string): void {
    if (this.isEditing) {
      return;
    }
    const match = this.matchFixedExpense(name);
    if (match && match.defaultAmount !== null) {
      this.form.patchValue({ amount: match.defaultAmount });
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const name = this.form.controls.name.value.trim();
    const match = this.matchFixedExpense(name);
    const payload = {
      fixedExpenseId: match ? match.id : null,
      name,
      amount: Math.trunc(this.form.controls.amount.value),
      occurredOn: this.form.controls.occurredOn.value,
    };

    try {
      const result = this.entry
        ? await firstValueFrom(this.expensesApi.update(this.entry.id, payload))
        : await firstValueFrom(this.expensesApi.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isBusy()) {
      return;
    }
    this.cancelled.emit();
  }

  private matchFixedExpense(name: string): FixedExpenseView | undefined {
    const normalized = name.trim().toLowerCase();
    return this.fixedExpenses().find((f) => f.name.trim().toLowerCase() === normalized);
  }
}
