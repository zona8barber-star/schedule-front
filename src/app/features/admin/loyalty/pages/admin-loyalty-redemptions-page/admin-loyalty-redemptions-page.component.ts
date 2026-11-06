import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import {
  LOYALTY_REWARD_KIND_LABELS,
  LoyaltyRedemptionView,
  redemptionStatusLabel,
} from '../../../../../core/models/loyalty-redemption.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

type RedemptionTab = 'Requested' | 'Deliveries' | 'History';

/**
 * Redemption inbox (ADR-0015): approve or reject requests (loyalty.redemptions.approve), deliver approved "other"
 * rewards (loyalty.redemptions.deliver) and cancel pending ones. Service rewards are delivered only by confirming
 * the service record. Both permissions are critical and checked by the API on every request.
 */
@Component({
  selector: 'app-admin-loyalty-redemptions-page',
  imports: [DatePipe, FormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-loyalty-redemptions-page.component.html',
  styleUrls: [
    '../../../service-records/pages/admin-service-records-page/admin-service-records-page.component.scss',
    './admin-loyalty-redemptions-page.component.scss',
  ],
})
export class AdminLoyaltyRedemptionsPageComponent implements OnInit {
  private readonly api = inject(LoyaltyRedemptionApiService);
  private readonly authService = inject(AuthService);

  readonly canApprove = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsApprove);
  readonly canDeliver = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsDeliver);
  readonly tabs: { id: RedemptionTab; label: string }[] = [
    ...(this.canApprove ? [{ id: 'Requested' as const, label: 'Por aprobar' }] : []),
    ...(this.canDeliver ? [{ id: 'Deliveries' as const, label: 'Por entregar' }] : []),
    ...(this.canApprove ? [{ id: 'History' as const, label: 'Historial' }] : []),
  ];

  readonly tab = signal<RedemptionTab>(this.tabs[0]?.id ?? 'Requested');
  readonly redemptions = signal<LoyaltyRedemptionView[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  /** A rejection or cancellation waiting for its reason. */
  readonly acting = signal<{ id: string; action: 'reject' | 'cancel' } | null>(null);
  reason = '';

  readonly statusLabel = redemptionStatusLabel;
  readonly kindLabels = LOYALTY_REWARD_KIND_LABELS;

  ngOnInit(): void {
    void this.load();
  }

  selectTab(tab: RedemptionTab): void {
    this.tab.set(tab);
    this.acting.set(null);
    void this.load();
  }

  startReason(redemption: LoyaltyRedemptionView, action: 'reject' | 'cancel'): void {
    this.reason = '';
    this.errorMessage.set(null);
    this.acting.set({ id: redemption.id, action });
  }

  async approve(redemption: LoyaltyRedemptionView): Promise<void> {
    await this.run(redemption, () => this.api.approve(redemption.id, redemption.version), 'Canje aprobado.');
  }

  async deliver(redemption: LoyaltyRedemptionView): Promise<void> {
    await this.run(redemption, () => this.api.deliver(redemption.id, redemption.version), 'Canje entregado.');
  }

  async confirmReason(redemption: LoyaltyRedemptionView): Promise<void> {
    const acting = this.acting();
    const reason = this.reason.trim();
    if (!acting || acting.id !== redemption.id) {
      return;
    }

    if (reason.length < 3) {
      this.errorMessage.set('Escribe el motivo (al menos 3 caracteres).');
      return;
    }

    await this.run(
      redemption,
      () =>
        acting.action === 'reject'
          ? this.api.reject(redemption.id, redemption.version, reason)
          : this.api.cancel(redemption.id, redemption.version, reason),
      acting.action === 'reject' ? 'Canje rechazado; sus puntos se liberaron.' : 'Canje cancelado; sus puntos se liberaron.',
    );
  }

  private async run(redemption: LoyaltyRedemptionView, action: () => Observable<LoyaltyRedemptionView>, message: string): Promise<void> {
    if (this.busyId()) {
      return;
    }

    this.busyId.set(redemption.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      await firstValueFrom(action());
      this.acting.set(null);
      this.successMessage.set(message);
      await this.load();
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 403
          ? 'Ya no tienes permiso para esta acción. Si crees que es un error, pide a un administrador que revise tu rol.'
          : getApiErrorMessage(error),
      );
      if (error instanceof HttpErrorResponse && error.status === 409) {
        await this.load(false);
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(clearMessages = true): Promise<void> {
    this.isLoading.set(true);
    if (clearMessages) {
      this.errorMessage.set(null);
    }

    try {
      const tab = this.tab();
      this.redemptions.set(
        await firstValueFrom(
          tab === 'Deliveries'
            ? this.api.getDeliveries()
            : this.api.getRedemptions(tab === 'Requested' ? 'Requested' : null),
        ),
      );
    } catch (error) {
      this.redemptions.set([]);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
