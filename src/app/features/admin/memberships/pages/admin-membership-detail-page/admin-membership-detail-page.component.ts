import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerMembershipDetailView, MembershipAllowanceView } from '../../../../../core/models/membership.models';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { GIFT_CONDITION_LABELS } from '../../../membership-plans/membership-plan-defaults';
import { AdminMembershipIncomeLinkModalComponent } from '../../components/admin-membership-income-link-modal/admin-membership-income-link-modal.component';
import { AdminMembershipReasonModalComponent } from '../../components/admin-membership-reason-modal/admin-membership-reason-modal.component';
import {
  MEMBERSHIP_EVENT_LABELS,
  MEMBERSHIP_GIFT_STATUS_LABELS,
  MEMBERSHIP_STATUS_LABELS,
  bogotaToday,
} from '../../membership-labels';

type MembershipModal = 'annul' | 'activateExpired' | 'link' | 'unlink';

@Component({
  selector: 'app-admin-membership-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    AdminMembershipReasonModalComponent,
    AdminMembershipIncomeLinkModalComponent,
  ],
  templateUrl: './admin-membership-detail-page.component.html',
  styleUrl: './admin-membership-detail-page.component.scss',
})
export class AdminMembershipDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly membershipsApi = inject(AdminMembershipsApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toastService = inject(ToastService);

  readonly statusLabels = MEMBERSHIP_STATUS_LABELS;
  readonly giftStatusLabels = MEMBERSHIP_GIFT_STATUS_LABELS;
  readonly eventLabels = MEMBERSHIP_EVENT_LABELS;
  readonly conditionLabels = GIFT_CONDITION_LABELS;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly membership = signal<CustomerMembershipDetailView | null>(null);
  readonly openModal = signal<MembershipModal | null>(null);
  readonly isBusy = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly isExpired = computed(() => {
    const membership = this.membership();
    return !!membership && membership.endsOn < bogotaToday();
  });

  /** Unlinking needs a justification when the memberships left on the income stop adding up to it. */
  readonly unlinkNeedsJustification = computed(() => {
    const income = this.membership()?.income;
    const membership = this.membership();
    if (!income || !membership || income.isDeleted || income.linkedMemberships.length <= 1) {
      return false;
    }
    return income.linkedMembershipsTotal - membership.price !== income.amount;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const membershipId = params.get('membershipId');
      if (membershipId) {
        void this.load(membershipId);
      }
    });
  }

  async activate(): Promise<void> {
    const membership = this.membership();
    if (!membership) return;

    if (this.isExpired()) {
      this.open('activateExpired');
      return;
    }

    const confirmed = await this.confirmModal.confirm({
      title: '¿Activar membresía?',
      message: `Se activará "${membership.planName}" para ${membership.customerName}.`,
      confirmLabel: 'Activar',
    });
    if (!confirmed) return;

    await this.run(() => this.membershipsApi.activate(membership.id, { confirmExpiredActivation: false, reason: null }), 'Membresía activada.');
  }

  async activateExpired(reason: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership) return;
    await this.run(
      () => this.membershipsApi.activate(membership.id, { confirmExpiredActivation: true, reason }),
      'Membresía activada de forma excepcional.',
    );
  }

  async annul(reason: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership || !reason) return;
    await this.run(() => this.membershipsApi.annul(membership.id, { reason }), 'Membresía anulada.');
  }

  async unlink(justification: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership) return;
    await this.run(
      () => this.membershipsApi.unlinkIncome(membership.id, { discrepancyJustification: justification }),
      'Ingreso desvinculado.',
    );
  }

  onLinked(membership: CustomerMembershipDetailView): void {
    this.membership.set(membership);
    this.openModal.set(null);
    this.toastService.success('Ingreso vinculado.');
  }

  open(modal: MembershipModal): void {
    this.modalError.set(null);
    this.openModal.set(modal);
  }

  closeModal(): void {
    if (this.isBusy()) return;
    this.openModal.set(null);
  }

  serviceNames(line: MembershipAllowanceView): string {
    return line.services.map((service) => service.serviceName).join(', ');
  }

  allowanceLabel(origin: 'Purchased' | 'Gift', serviceCount: number): string {
    if (origin === 'Gift') return 'Obsequio';
    return serviceCount > 1 ? 'Bolsa compartida' : 'Comprado';
  }

  private async run(action: () => ReturnType<AdminMembershipsApiService['getById']>, success: string): Promise<void> {
    this.isBusy.set(true);
    this.modalError.set(null);
    this.errorMessage.set(null);
    try {
      this.membership.set(await firstValueFrom(action()));
      this.openModal.set(null);
      this.toastService.success(success);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (this.openModal()) {
        this.modalError.set(message);
      } else {
        this.errorMessage.set(message);
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  private async load(membershipId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.openModal.set(null);
    try {
      this.membership.set(await firstValueFrom(this.membershipsApi.getById(membershipId)));
    } catch (error) {
      this.membership.set(null);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
