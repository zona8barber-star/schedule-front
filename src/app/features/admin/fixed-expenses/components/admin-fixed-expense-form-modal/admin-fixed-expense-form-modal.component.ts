import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FixedExpenseView } from '../../../../../core/models/fixed-expense.models';
import { AdminFixedExpensesApiService } from '../../../../../core/services/admin-fixed-expenses-api.service';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';

function nonNegativeIntegerOrEmptyValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === '' || value === undefined) {
    return null;
  }
  return Number.isInteger(value) && value >= 0 ? null : { invalidAmount: true };
}

import { FieldErrorComponent } from '../../../../../shared/components/field-error/field-error.component';

import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

import { FormA11yDirective } from '../../../../../shared/directives/form-a11y.directive';

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-admin-fixed-expense-form-modal',
  imports: [FormA11yDirective, ModalDialogDirective, FieldErrorComponent, ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-fixed-expense-form-modal.component.html',
  styleUrl: './admin-fixed-expense-form-modal.component.scss',
})
export class AdminFixedExpenseFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(AdminFixedExpensesApiService);
  private readonly moneyConfirmation = inject(MoneyConfirmationService);

  @Input() fixedExpenseId: string | null = null;
  @Output() readonly saved = new EventEmitter<FixedExpenseView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isSaving() || this.isLoading());

  readonly form = this.formBuilder.group({
    name: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    defaultAmount: [null as number | null, [nonNegativeIntegerOrEmptyValidator]],
  });

  get isEditing(): boolean {
    return this.fixedExpenseId !== null;
  }

  async ngOnInit(): Promise<void> {
    if (!this.fixedExpenseId) {
      return;
    }

    this.isLoading.set(true);
    try {
      const item = await firstValueFrom(this.api.getById(this.fixedExpenseId));
      this.form.patchValue({ name: item.name, defaultAmount: item.defaultAmount });
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  @SingleFlight()
  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawAmount = this.form.controls.defaultAmount.value;
    const payload = {
      name: (this.form.controls.name.value ?? '').trim(),
      defaultAmount: rawAmount === null || rawAmount === undefined ? null : Math.trunc(rawAmount),
    };

    // SONDA BUG-169 (ADR-0021 L6): the default amount is a money value too, so it is confirmed before saving.
    if (payload.defaultAmount !== null) {
      const confirmed = await this.moneyConfirmation.confirm({
        action: this.fixedExpenseId ? 'Guardar el monto por defecto' : 'Crear el gasto fijo',
        amount: payload.defaultAmount,
        detail: payload.name || undefined,
      });
      if (!confirmed) return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    try {
      const result = this.fixedExpenseId
        ? await firstValueFrom(this.api.update(this.fixedExpenseId, payload))
        : await firstValueFrom(this.api.create(payload));
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
}
