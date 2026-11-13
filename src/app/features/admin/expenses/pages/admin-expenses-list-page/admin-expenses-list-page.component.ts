import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ExpenseEntryView } from '../../../../../core/models/expense.models';
import { AdminExpensesApiService } from '../../../../../core/services/admin-expenses-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminExpenseFormModalComponent } from '../../components/admin-expense-form-modal/admin-expense-form-modal.component';

/** Bogotá's month and day, whatever the device timezone (SONDA BUG-033). */
function currentMonthIso(): string {
  return bogotaToday().slice(0, 7);
}

function todayIso(): string {
  return bogotaToday();
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
  /** Increases with every load; an answer whose number is no longer the latest is ignored. */
  private loadSequence = 0;
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
      // SONDA BUG-083: pesos with thousands separator (C2 format).
      message: `Se eliminará "${entry.name}" (${formatCop(entry.amount)}).`,
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
      if (error instanceof HttpErrorResponse && error.status === 404) {
        // Same as SONDA BUG-084: already deleted elsewhere; say so and refresh the list.
        await this.load();
        this.errorMessage.set('Este gasto ya no existe: se eliminó en otra pestaña o por otra persona. La lista se actualizó.');
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    // Same pattern as SONDA BUG-082: only the answer for the latest month is shown.
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const [yearText, monthText] = this.selectedMonth().split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    try {
      const entries = await firstValueFrom(this.api.list(year, month));
      if (sequence !== this.loadSequence) return;
      this.entries.set(entries);
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
