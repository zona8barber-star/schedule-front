import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerSummaryResponse,
  NotificationBroadcastRequest,
  NotificationBroadcastTargetType,
  NotificationCampaignResponse,
} from '../../../../../core/models/notification.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const searchDebounceMs = 350;

@Component({
  selector: 'app-admin-notifications-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-notifications-page.component.html',
  styleUrl: './admin-notifications-page.component.scss',
})
export class AdminNotificationsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationsApiService = inject(NotificationsApiService);
  private readonly adminStaffApiService = inject(AdminStaffApiService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly submitted = signal(false);
  readonly isLoadingCampaigns = signal(true);
  readonly isLoadingStaff = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly campaigns = signal<NotificationCampaignResponse[]>([]);
  readonly staffOptions = signal<StaffListItem[]>([]);

  readonly searchTerm = signal('');
  readonly searchResults = signal<CustomerSummaryResponse[]>([]);
  readonly isSearchingCustomers = signal(false);
  readonly selectedCustomers = signal<CustomerSummaryResponse[]>([]);

  readonly isBusy = computed(() => this.isSubmitting());

  readonly broadcastForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    body: ['', [Validators.required, Validators.maxLength(1000)]],
    targetType: ['all', [Validators.required]],
    staffProfileId: [''],
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadCampaigns(), this.loadStaff()]);
  }

  get targetType(): NotificationBroadcastTargetType {
    return this.broadcastForm.controls.targetType.value as NotificationBroadcastTargetType;
  }

  selectTargetType(targetType: NotificationBroadcastTargetType): void {
    if (this.isBusy()) {
      return;
    }

    this.broadcastForm.controls.targetType.setValue(targetType);
    this.errorMessage.set(null);
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);

    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      this.searchResults.set([]);
      this.isSearchingCustomers.set(false);
      return;
    }

    this.searchDebounceHandle = setTimeout(() => void this.searchCustomers(trimmed), searchDebounceMs);
  }

  addCustomer(customer: CustomerSummaryResponse): void {
    if (this.selectedCustomers().some((selected) => selected.id === customer.id)) {
      return;
    }

    this.selectedCustomers.update((customers) => [...customers, customer]);
    this.searchResults.update((results) => results.filter((result) => result.id !== customer.id));
  }

  removeCustomer(customer: CustomerSummaryResponse): void {
    this.selectedCustomers.update((customers) => customers.filter((selected) => selected.id !== customer.id));
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.broadcastForm.invalid) {
      this.broadcastForm.markAllAsTouched();
      return;
    }

    const targetType = this.targetType;

    if (targetType === 'selected' && this.selectedCustomers().length === 0) {
      this.errorMessage.set('Selecciona al menos un cliente.');
      return;
    }

    if (targetType === 'filter' && !this.broadcastForm.controls.staffProfileId.value) {
      this.errorMessage.set('Selecciona un profesional.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const value = this.broadcastForm.getRawValue();
      const request: NotificationBroadcastRequest = {
        title: (value.title ?? '').trim(),
        body: (value.body ?? '').trim(),
        targetType,
        customerUserIds:
          targetType === 'selected' ? this.selectedCustomers().map((customer) => customer.id) : null,
        staffProfileId: targetType === 'filter' ? value.staffProfileId || null : null,
      };

      const campaign = await firstValueFrom(this.notificationsApiService.broadcast(request));
      this.successMessage.set(`Notificacion enviada a ${campaign.recipientCount} cliente(s).`);
      this.resetForm();
      await this.loadCampaigns();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm(): void {
    this.submitted.set(false);
    this.broadcastForm.reset(
      { title: '', body: '', targetType: 'all', staffProfileId: '' },
      { emitEvent: false },
    );
    this.selectedCustomers.set([]);
    this.searchResults.set([]);
    this.searchTerm.set('');
  }

  showError(controlName: 'title' | 'body', errorName: string): boolean {
    const control = this.broadcastForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private async searchCustomers(term: string): Promise<void> {
    this.isSearchingCustomers.set(true);

    try {
      const results = await firstValueFrom(this.notificationsApiService.searchCustomers(term));
      const selectedIds = new Set(this.selectedCustomers().map((customer) => customer.id));
      this.searchResults.set(results.filter((customer) => !selectedIds.has(customer.id)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.searchResults.set([]);
    } finally {
      this.isSearchingCustomers.set(false);
    }
  }

  private async loadCampaigns(): Promise<void> {
    this.isLoadingCampaigns.set(true);

    try {
      const campaigns = await firstValueFrom(this.notificationsApiService.getCampaigns());
      this.campaigns.set(campaigns);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.campaigns.set([]);
    } finally {
      this.isLoadingCampaigns.set(false);
    }
  }

  private async loadStaff(): Promise<void> {
    this.isLoadingStaff.set(true);

    try {
      const staff = await firstValueFrom(this.adminStaffApiService.list());
      this.staffOptions.set(staff);
    } catch {
      this.staffOptions.set([]);
    } finally {
      this.isLoadingStaff.set(false);
    }
  }
}
