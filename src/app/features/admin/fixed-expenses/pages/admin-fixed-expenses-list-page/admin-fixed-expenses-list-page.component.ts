import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { FixedExpenseView } from '../../../../../core/models/fixed-expense.models';
import { AdminFixedExpensesApiService } from '../../../../../core/services/admin-fixed-expenses-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminFixedExpenseFormModalComponent } from '../../components/admin-fixed-expense-form-modal/admin-fixed-expense-form-modal.component';

@Component({
  selector: 'app-admin-fixed-expenses-list-page',
  imports: [DecimalPipe, RouterLink, ApiFeedbackComponent, AdminFixedExpenseFormModalComponent],
  templateUrl: './admin-fixed-expenses-list-page.component.html',
  styleUrl: './admin-fixed-expenses-list-page.component.scss',
})
export class AdminFixedExpensesListPageComponent implements OnInit {
  private readonly api = inject(AdminFixedExpensesApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly items = signal<FixedExpenseView[]>([]);
  readonly isModalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(id: string): void {
    this.editingId.set(id);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingId.set(null);
  }

  onSaved(result: FixedExpenseView): void {
    const exists = this.items().some((i) => i.id === result.id);
    this.items.update((list) =>
      exists ? list.map((i) => (i.id === result.id ? result : i)) : [...list, result],
    );
    this.closeModal();
  }

  async toggleActive(item: FixedExpenseView): Promise<void> {
    this.busyId.set(item.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateStatus(item.id, { isActive: !item.isActive }));
      this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async deleteItem(item: FixedExpenseView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar gasto fijo?',
      message: `Se eliminará "${item.name}". Los gastos ya registrados conservan su nombre.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(item.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.api.remove(item.id));
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
