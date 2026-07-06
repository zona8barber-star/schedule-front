import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ExpenseEntryView } from '../../../../../core/models/expense.models';
import { AdminExpensesApiService } from '../../../../../core/services/admin-expenses-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminExpenseFormModalComponent } from '../../components/admin-expense-form-modal/admin-expense-form-modal.component';

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-admin-expenses-list-page',
  imports: [FormsModule, DecimalPipe, RouterLink, ApiFeedbackComponent, AdminExpenseFormModalComponent],
  templateUrl: './admin-expenses-list-page.component.html',
  styleUrl: './admin-expenses-list-page.component.scss',
})
export class AdminExpensesListPageComponent implements OnInit {
  private readonly api = inject(AdminExpensesApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly today = todayIso();
  readonly selectedMonth = signal(currentMonthIso());
  readonly entries = signal<ExpenseEntryView[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly editingEntry = signal<ExpenseEntryView | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly total = computed(() => this.entries().reduce((sum, e) => sum + e.amount, 0));

  ngOnInit(): void {
    void this.load();
  }

  onMonthChange(month: string): void {
    if (!month) {
      return;
    }
    this.selectedMonth.set(month);
    void this.load();
  }

  openCreate(): void {
    this.editingEntry.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(entry: ExpenseEntryView): void {
    this.editingEntry.set(entry);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingEntry.set(null);
  }

  onSaved(): void {
    this.closeModal();
    void this.load();
  }

  async deleteEntry(entry: ExpenseEntryView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar gasto?',
      message: `Se eliminará "${entry.name}" ($ ${entry.amount}).`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(entry.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.api.remove(entry.id));
      this.entries.update((list) => list.filter((e) => e.id !== entry.id));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const [yearText, monthText] = this.selectedMonth().split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    try {
      this.entries.set(await firstValueFrom(this.api.list(year, month)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
