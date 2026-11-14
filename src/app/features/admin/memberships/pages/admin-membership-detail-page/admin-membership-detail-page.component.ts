import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  CustomerMembershipDetailView,
  MembershipAllowanceView,
  MembershipConsumptionView,
  MembershipGiftView,
} from '../../../../../core/models/membership.models';
import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { isGuid, isNotFoundError } from '../../../../../core/utils/route-id.utils';
import { NotFoundStateComponent } from '../../../../../shared/components/not-found-state/not-found-state.component';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { GIFT_CONDITION_LABELS } from '../../../membership-plans/membership-plan-defaults';
import { AdminMembershipConsumeModalComponent } from '../../components/admin-membership-consume-modal/admin-membership-consume-modal.component';
import { AdminMembershipGiftDeliveryModalComponent } from '../../components/admin-membership-gift-delivery-modal/admin-membership-gift-delivery-modal.component';
import { AdminMembershipIncomeLinkModalComponent } from '../../components/admin-membership-income-link-modal/admin-membership-income-link-modal.component';
import { AdminMembershipReasonModalComponent } from '../../components/admin-membership-reason-modal/admin-membership-reason-modal.component';
import {
  MEMBERSHIP_EVENT_LABELS,
  MEMBERSHIP_GIFT_STATUS_LABELS,
  MEMBERSHIP_STATUS_LABELS,
  bogotaToday,
} from '../../membership-labels';

type MembershipModal =
  | 'annul'
  | 'activateExpired'
  | 'link'
  | 'unlink'
  | 'consume'
  | 'reverse'
  | 'deliverGift'
  | 'reverseDelivery';

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-admin-membership-detail-page',
  imports: [NotFoundStateComponent, BogotaDatePipe, 
    DecimalPipe,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    AdminMembershipReasonModalComponent,
    AdminMembershipIncomeLinkModalComponent,
    AdminMembershipConsumeModalComponent,
    AdminMembershipGiftDeliveryModalComponent,
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
  private readonly authService = inject(AuthService);

  /** The first income link credits the membership's points, so it needs memberships.payments.confirm (critical). */
  readonly canConfirmPayment = this.authService.hasPermission(PERMISSION_CODES.membershipPaymentsConfirm);
  readonly loyaltyDecisionLabels: Record<string, string> = {
    Accrued: 'Acumuló sus puntos al vincular el primer ingreso',
    NotAccruedProgramDisabled: 'No acumuló: el programa estaba deshabilitado al vincular el primer ingreso',
    NotAccruedNoPoints: 'No acumuló: el tipo de membresía no tenía puntos',
    NotAccruedPredatesWallet: 'No acumula: vendida antes de existir la billetera de puntos',
    NotAccruedAnnulled: 'No acumuló: estaba anulada al vincular el primer ingreso',
  };

  readonly statusLabels = MEMBERSHIP_STATUS_LABELS;
  readonly giftStatusLabels = MEMBERSHIP_GIFT_STATUS_LABELS;
  readonly eventLabels = MEMBERSHIP_EVENT_LABELS;
  readonly conditionLabels = GIFT_CONDITION_LABELS;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** SONDA BUG-044: the membership of the link does not exist. */
  readonly notFound = signal(false);
  readonly membership = signal<CustomerMembershipDetailView | null>(null);
  readonly openModal = signal<MembershipModal | null>(null);
  readonly isBusy = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly reversing = signal<MembershipConsumptionView | null>(null);
  readonly selectedGift = signal<MembershipGiftView | null>(null);

  /** Consumptions need an active membership that has started; an expired one still takes retroactive ones. */
  readonly canConsume = computed(() => {
    const membership = this.membership();
    return membership?.status === 'Active' && membership.displayStatus !== 'Scheduled';
  });

  /** Purchased and gifted units, granted and still available, kept apart. */
  readonly totals = computed(() => {
    const lines = this.membership()?.allowances ?? [];
    const sum = (origin: 'Purchased' | 'Gift', pick: (line: MembershipAllowanceView) => number) =>
      lines.filter((line) => line.origin === origin).reduce((total, line) => total + pick(line), 0);
    return {
      purchasedGranted: sum('Purchased', (line) => line.grantedQuantity),
      purchasedAvailable: sum('Purchased', (line) => line.availableQuantity),
      giftedGranted: sum('Gift', (line) => line.grantedQuantity),
      giftedAvailable: sum('Gift', (line) => line.availableQuantity),
    };
  });

  readonly isExpired = computed(() => {
    const membership = this.membership();
    return !!membership && membership.endsOn < bogotaToday();
  });

  /**
   * SONDA BUG-104: the justification recorded for the current income, from the latest link or amount change of that
   * income that carries one; null when none was recorded (the notice no longer claims one that does not exist).
   */
  readonly discrepancyJustification = computed(() => {
    const membership = this.membership();
    const incomeId = membership?.income?.incomeEntryId;
    if (!membership || !incomeId) return null;
    const latest = membership.events
      .filter(
        (event) =>
          event.incomeEntryId === incomeId &&
          (event.type === 'IncomeLinked' || event.type === 'IncomeAmountChanged') &&
          !!event.reason?.trim(),
      )
      .sort((first, second) => second.performedAt.localeCompare(first.performedAt))[0];
    return latest?.reason?.trim() ?? null;
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

  @SingleFlight()
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
      // SONDA BUG-086: a constructive action, not the bin and the red button of a deletion.
      danger: false,
      icon: 'check',
    });
    if (!confirmed) return;

    await this.run(() => this.membershipsApi.activate(membership.id, { confirmExpiredActivation: false, reason: null }), 'Membresía activada.');
  }

  @SingleFlight()
  async activateExpired(reason: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership) return;
    await this.run(
      () => this.membershipsApi.activate(membership.id, { confirmExpiredActivation: true, reason }),
      'Membresía activada de forma excepcional.',
    );
  }

  @SingleFlight()
  async annul(reason: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership || !reason) return;
    await this.run(() => this.membershipsApi.annul(membership.id, { reason }), 'Membresía anulada.');
  }

  @SingleFlight()
  async unlink(justification: string | null): Promise<void> {
    const membership = this.membership();
    if (!membership) return;
    await this.run(
      () => this.membershipsApi.unlinkIncome(membership.id, { discrepancyJustification: justification }),
      'Ingreso desvinculado.',
    );
  }

  onConsumed(membership: CustomerMembershipDetailView): void {
    this.membership.set(membership);
    this.openModal.set(null);
    this.toastService.success('Consumo registrado.');
  }

  openReverse(consumption: MembershipConsumptionView): void {
    this.reversing.set(consumption);
    this.open('reverse');
  }

  @SingleFlight()
  async reverse(reason: string | null): Promise<void> {
    const membership = this.membership();
    const consumption = this.reversing();
    if (!membership || !consumption || !reason) return;
    await this.run(
      () => this.membershipsApi.reverseConsumption(membership.id, consumption.id, { reason }),
      'Consumo revertido.',
    );
  }

  canReverse(consumption: MembershipConsumptionView): boolean {
    return !consumption.reversal && this.membership()?.status !== 'PendingActivation';
  }

  partsLabel(consumption: MembershipConsumptionView): string {
    const count = (origin: 'Purchased' | 'Gift') =>
      consumption.parts.filter((part) => part.origin === origin).reduce((total, part) => total + part.quantity, 0);
    const parts: string[] = [];
    if (count('Gift')) parts.push(`${count('Gift')} regalado(s)`);
    if (count('Purchased')) parts.push(`${count('Purchased')} pagado(s)`);
    return parts.join(' + ');
  }

  reverseMessage(membership: CustomerMembershipDetailView): string {
    const consumption = this.reversing();
    const base = consumption
      ? `Se devolverán ${consumption.quantity} × ${consumption.serviceName} a los saldos de donde salieron. El registro original se conserva.`
      : '';
    return membership.status === 'Annulled' ? `${base} La membresía sigue anulada: esas unidades quedan bloqueadas.` : base;
  }

  /** Physical gifts are handed over once the membership is active, never on an annulled one. */
  canDeliver(gift: MembershipGiftView): boolean {
    return gift.kind === 'Physical' && gift.status === 'PendingDelivery' && this.membership()?.status === 'Active';
  }

  openDelivery(gift: MembershipGiftView): void {
    this.selectedGift.set(gift);
    this.open('deliverGift');
  }

  onDelivered(membership: CustomerMembershipDetailView): void {
    this.membership.set(membership);
    this.openModal.set(null);
    this.toastService.success('Entrega registrada.');
  }

  openDeliveryReversal(gift: MembershipGiftView): void {
    this.selectedGift.set(gift);
    this.open('reverseDelivery');
  }

  @SingleFlight()
  async reverseDelivery(reason: string | null): Promise<void> {
    const membership = this.membership();
    const gift = this.selectedGift();
    if (!membership || !gift?.deliveryId || !reason) return;
    await this.run(
      () => this.membershipsApi.reverseGiftDelivery(membership.id, gift.id, gift.deliveryId!, { reason }),
      'Entrega revertida.',
    );
  }

  reverseDeliveryMessage(membership: CustomerMembershipDetailView): string {
    const gift = this.selectedGift();
    const base = gift ? `La entrega de ${gift.quantity} × ${gift.description} se marcará como revertida; el registro se conserva.` : '';
    return membership.status === 'Annulled'
      ? `${base} La membresía está anulada: el obsequio quedará no entregable.`
      : `${base} El obsequio volverá a quedar pendiente de entrega.`;
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
    this.notFound.set(false);
    // SONDA BUG-044: an id that is not a GUID cannot exist; no request is sent.
    if (!isGuid(membershipId)) {
      this.membership.set(null);
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }
    this.openModal.set(null);
    try {
      this.membership.set(await firstValueFrom(this.membershipsApi.getById(membershipId)));
    } catch (error) {
      this.membership.set(null);
      if (isNotFoundError(error)) {
        this.notFound.set(true);
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
