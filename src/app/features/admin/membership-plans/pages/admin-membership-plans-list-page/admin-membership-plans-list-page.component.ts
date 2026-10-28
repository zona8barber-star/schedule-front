import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { AdminMembershipPlansApiService } from '../../../../../core/services/admin-membership-plans-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { AdminMembershipPlanFormModalComponent } from '../../components/admin-membership-plan-form-modal/admin-membership-plan-form-modal.component';

@Component({
  selector: 'app-admin-membership-plans-list-page',
  imports: [DecimalPipe, ApiFeedbackComponent, PageStateComponent, AdminMembershipPlanFormModalComponent],
  templateUrl: './admin-membership-plans-list-page.component.html',
  styleUrl: './admin-membership-plans-list-page.component.scss',
})
export class AdminMembershipPlansListPageComponent implements OnInit {
  private readonly membershipPlansApiService = inject(AdminMembershipPlansApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly plans = signal<MembershipPlanView[]>([]);
  readonly isModalOpen = signal(false);
  readonly editingPlanId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  openCreate(): void {
    this.editingPlanId.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(planId: string): void {
    this.editingPlanId.set(planId);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingPlanId.set(null);
  }

  onSaved(result: MembershipPlanView): void {
    const exists = this.plans().some((plan) => plan.id === result.id);
    this.plans.update((list) =>
      (exists ? list.map((plan) => (plan.id === result.id ? result : plan)) : [...list, result]).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      ),
    );
    this.closeModal();
  }

  modeSummary(plan: MembershipPlanView): string {
    if (plan.mode === 'Pool') {
      return `Bolsa común: ${plan.poolQuantity} servicios`;
    }
    const total = plan.services.reduce((sum, service) => sum + (service.quantity ?? 0), 0);
    return `Por servicio: ${total} en total`;
  }

  servicesSummary(plan: MembershipPlanView): string {
    return plan.services
      .map((service) => (plan.mode === 'PerService' ? `${service.quantity} × ${service.serviceName}` : service.serviceName))
      .join(', ');
  }

  async toggleActive(plan: MembershipPlanView): Promise<void> {
    this.busyId.set(plan.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(
        this.membershipPlansApiService.updateStatus(plan.id, { isActive: !plan.isActive }),
      );
      this.plans.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async deletePlan(plan: MembershipPlanView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar tipo de membresía?',
      message: `Se eliminará "${plan.name}" del catálogo. Las membresías ya vendidas no cambian.`,
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(plan.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.membershipPlansApiService.remove(plan.id));
      this.plans.update((list) => list.filter((item) => item.id !== plan.id));
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
      this.plans.set(await firstValueFrom(this.membershipPlansApiService.list()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
