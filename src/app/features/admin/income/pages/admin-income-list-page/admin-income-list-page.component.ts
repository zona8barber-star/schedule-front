import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { IncomeEntryView } from '../../../../../core/models/income.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminIncomeApiService } from '../../../../../core/services/admin-income-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminIncomeFormModalComponent } from '../../components/admin-income-form-modal/admin-income-form-modal.component';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-admin-income-list-page',
  imports: [FormsModule, DecimalPipe, ApiFeedbackComponent, AdminIncomeFormModalComponent],
  templateUrl: './admin-income-list-page.component.html',
  styleUrl: './admin-income-list-page.component.scss',
})
export class AdminIncomeListPageComponent implements OnInit {
  private readonly incomeApi = inject(AdminIncomeApiService);
  private readonly staffApi = inject(AdminStaffApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly today = todayIso();
  readonly selectedDate = signal(this.today);
  readonly selectedStaffId = signal<string>('');
  readonly staff = signal<StaffListItem[]>([]);
  readonly entries = signal<IncomeEntryView[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly editingEntry = signal<IncomeEntryView | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly total = computed(() => this.entries().reduce((sum, entry) => sum + entry.amount, 0));

  async ngOnInit(): Promise<void> {
    try {
      this.staff.set(await firstValueFrom(this.staffApi.list()));
    } catch {
      // A staff-load failure shouldn't block the income list; the filter just stays empty.
    }
    await this.load();
  }

  onDateChange(date: string): void {
    this.selectedDate.set(date);
    void this.load();
  }

  onStaffChange(staffId: string): void {
    this.selectedStaffId.set(staffId);
    void this.load();
  }

  openCreate(): void {
    this.editingEntry.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(entry: IncomeEntryView): void {
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

  async deleteEntry(entry: IncomeEntryView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar ingreso?',
      message: `Se eliminará el ingreso de "${entry.serviceName}" ($ ${entry.amount}).`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(entry.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.incomeApi.remove(entry.id));
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
    try {
      const staffId = this.selectedStaffId() || null;
      this.entries.set(await firstValueFrom(this.incomeApi.list(this.selectedDate(), staffId)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
