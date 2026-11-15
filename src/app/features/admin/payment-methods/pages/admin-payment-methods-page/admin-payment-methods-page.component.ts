import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PaymentMethodView } from '../../../../../core/models/bill.models';
import { BillsApiService } from '../../../../../core/services/bills-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';
import { SingleFlight } from '../../../../../core/utils/single-flight';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { FormA11yDirective } from '../../../../../shared/directives/form-a11y.directive';
import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

/**
 * Payment methods (ADR-0020 Q1): the list the bills offer when closing. A method is deactivated, never deleted, so the
 * bills that used it keep its name.
 */
@Component({
  selector: 'app-admin-payment-methods-page',
  imports: [FormA11yDirective, ModalDialogDirective, ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-payment-methods-page.component.html',
  styleUrls: ['../../../service-catalog/catalog-page.scss'],
})
export class AdminPaymentMethodsPageComponent implements OnInit {
  private readonly api = inject(BillsApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly methods = signal<PaymentMethodView[]>([]);
  readonly editing = signal<PaymentMethodView | 'new' | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(60)]],
    sortOrder: [null as number | null, [Validators.min(0), Validators.max(9999)]],
    isActive: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  openNew(): void {
    this.form.reset({ name: '', sortOrder: null, isActive: true });
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(method: PaymentMethodView): void {
    this.form.reset({ name: method.name, sortOrder: method.sortOrder, isActive: method.isActive });
    this.formError.set(null);
    this.editing.set(method);
  }

  closeModal(): void {
    if (!this.isSaving()) {
      this.editing.set(null);
    }
  }

  @SingleFlight()
  async save(): Promise<void> {
    const target = this.editing();
    if (!target) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      sortOrder: value.sortOrder === null ? null : Math.trunc(value.sortOrder),
      isActive: value.isActive,
    };
    this.isSaving.set(true);
    this.formError.set(null);
    try {
      await firstValueFrom(target === 'new' ? this.api.createPaymentMethod(request) : this.api.updatePaymentMethod(target.id, request));
      this.isSaving.set(false);
      this.editing.set(null);
      this.successMessage.set(target === 'new' ? `Método «${request.name}» creado.` : `Método «${request.name}» actualizado.`);
      await this.load();
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.methods.set(await firstValueFrom(this.api.paymentMethods()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
