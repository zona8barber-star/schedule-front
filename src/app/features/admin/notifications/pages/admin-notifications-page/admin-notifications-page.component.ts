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
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../../core/utils/bogota-date.utils';
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
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dateTimeFormatter = bogotaDateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly submitted = signal(false);
  readonly isLoadingCampaigns = signal(true);
  readonly isLoadingStaff = signal(true);
  readonly isSubmitting = signal(false);
  /** BUG-110: counting the recipients before the confirmation. */
  readonly isPreviewing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly campaigns = signal<NotificationCampaignResponse[]>([]);
  readonly staffOptions = signal<StaffListItem[]>([]);

  readonly searchTerm = signal('');
  readonly searchResults = signal<CustomerSummaryResponse[]>([]);
  readonly isSearchingCustomers = signal(false);
  readonly selectedCustomers = signal<CustomerSummaryResponse[]>([]);

  readonly isBusy = computed(() => this.isSubmitting() || this.isPreviewing());

  readonly broadcastForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    body: ['', [Validators.required, Validators.maxLength(1000)]],
    // BUG-110: no audience is chosen by default; «Todos los clientes» must be picked on purpose.
    targetType: ['', [Validators.required]],
    staffProfileId: [''],
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadCampaigns(), this.loadStaff()]);
  }

  get targetType(): NotificationBroadcastTargetType | null {
    return (this.broadcastForm.controls.targetType.value || null) as NotificationBroadcastTargetType | null;
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

    const targetType = this.targetType;

    if (!targetType) {
      this.broadcastForm.markAllAsTouched();
      this.errorMessage.set('Elige a quién enviar la notificación.');
      return;
    }

    if (this.broadcastForm.invalid) {
      this.broadcastForm.markAllAsTouched();
      return;
    }

    if (targetType === 'selected' && this.selectedCustomers().length === 0) {
      this.errorMessage.set('Selecciona al menos un cliente.');
      return;
    }

    if (targetType === 'filter' && !this.broadcastForm.controls.staffProfileId.value) {
      this.errorMessage.set('Selecciona un profesional.');
      return;
    }

    const value = this.broadcastForm.getRawValue();
    const request: NotificationBroadcastRequest = {
      title: (value.title ?? '').trim(),
      body: (value.body ?? '').trim(),
      targetType,
      customerUserIds:
        targetType === 'selected' ? this.selectedCustomers().map((customer) => customer.id) : null,
      staffProfileId: targetType === 'filter' ? value.staffProfileId || null : null,
    };

    if (!(await this.confirmRecipients(request))) {
      return;
    }

    this.isSubmitting.set(true);

    try {
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
      { title: '', body: '', targetType: '', staffProfileId: '' },
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

  /**
   * BUG-110: before sending, asks the server how many customers the broadcast reaches and shows that number with
   * the notice as it will look. Nothing is sent without that confirmation.
   */
  private async confirmRecipients(request: NotificationBroadcastRequest): Promise<boolean> {
    this.isPreviewing.set(true);
    let preview: { recipientCount: number; targetSummary: string };

    try {
      preview = await firstValueFrom(this.notificationsApiService.previewBroadcast(request));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      return false;
    } finally {
      this.isPreviewing.set(false);
    }

    const { recipientCount, targetSummary } = preview;
    if (recipientCount === 0) {
      this.errorMessage.set('Ningún cliente activo coincide con estos destinatarios; no hay a quién enviarla.');
      return false;
    }

    const customers = recipientCount === 1 ? '1 cliente' : `${recipientCount} clientes`;
    return this.confirmModal.confirm({
      title: '¿Enviar esta notificación?',
      message: `Llegará a ${customers} (${targetSummary}). Así se verá:`,
      preview: { title: request.title, body: request.body },
      confirmLabel: `Enviar a ${customers}`,
      danger: false,
      icon: 'bell',
    });
  }

  /** Increases with every search; results of an earlier term are dropped (same pattern as SONDA BUG-082). */
  private searchSequence = 0;

  private async searchCustomers(term: string): Promise<void> {
    const sequence = ++this.searchSequence;
    this.isSearchingCustomers.set(true);

    try {
      const results = await firstValueFrom(this.notificationsApiService.searchCustomers(term));
      if (sequence !== this.searchSequence) return;
      const selectedIds = new Set(this.selectedCustomers().map((customer) => customer.id));
      this.searchResults.set(results.filter((customer) => !selectedIds.has(customer.id)));
    } catch (error) {
      if (sequence !== this.searchSequence) return;
      this.errorMessage.set(getApiErrorMessage(error));
      this.searchResults.set([]);
    } finally {
      if (sequence === this.searchSequence) {
        this.isSearchingCustomers.set(false);
      }
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
