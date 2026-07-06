import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ServiceView } from '../../../../../core/models/service.models';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminServiceFormModalComponent } from '../../components/admin-service-form-modal/admin-service-form-modal.component';

@Component({
  selector: 'app-admin-services-list-page',
  imports: [DecimalPipe, ApiFeedbackComponent, AdminServiceFormModalComponent],
  templateUrl: './admin-services-list-page.component.html',
  styleUrl: './admin-services-list-page.component.scss',
})
export class AdminServicesListPageComponent implements OnInit {
  private readonly adminServicesApiService = inject(AdminServicesApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly services = signal<ServiceView[]>([]);
  readonly isModalOpen = signal(false);
  readonly editingServiceId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  openCreate(): void {
    this.editingServiceId.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(serviceId: string): void {
    this.editingServiceId.set(serviceId);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingServiceId.set(null);
  }

  onSaved(result: ServiceView): void {
    const exists = this.services().some((s) => s.id === result.id);
    this.services.update((list) =>
      exists ? list.map((s) => (s.id === result.id ? result : s)) : [...list, result],
    );
    this.closeModal();
  }

  async toggleActive(service: ServiceView): Promise<void> {
    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(
        this.adminServicesApiService.updateStatus(service.id, { isActive: !service.isActive }),
      );
      this.services.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async deleteService(service: ServiceView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar servicio?',
      message: `Se eliminará "${service.name}". No aparecerá en las listas, pero se conserva para el histórico.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.adminServicesApiService.remove(service.id));
      this.services.update((list) => list.filter((s) => s.id !== service.id));
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
      this.services.set(await firstValueFrom(this.adminServicesApiService.list()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
