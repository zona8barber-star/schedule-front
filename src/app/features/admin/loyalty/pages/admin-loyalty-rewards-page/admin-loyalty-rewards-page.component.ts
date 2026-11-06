import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { LOYALTY_MAX_POINTS_PER_ITEM } from '../../../../../core/models/loyalty.models';
import {
  LOYALTY_REWARD_KIND_LABELS,
  LoyaltyRewardChangeView,
  LoyaltyRewardKind,
  LoyaltyRewardServiceOption,
  LoyaltyRewardView,
} from '../../../../../core/models/loyalty-redemption.models';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

/**
 * Rewards catalog (loyalty.rewards.manage, ADR-0015 R1–R2): fixed cost in points, a catalog service or another reward
 * without stock, deactivation instead of deletion and an audited history. Requests keep their own copy, so editing
 * here never changes them.
 */
@Component({
  selector: 'app-admin-loyalty-rewards-page',
  imports: [DatePipe, ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-loyalty-rewards-page.component.html',
  styleUrls: [
    '../admin-loyalty-settings-page/admin-loyalty-settings-page.component.scss',
    './admin-loyalty-rewards-page.component.scss',
  ],
})
export class AdminLoyaltyRewardsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(LoyaltyRedemptionApiService);

  readonly maxCost = LOYALTY_MAX_POINTS_PER_ITEM;
  readonly kindLabels = LOYALTY_REWARD_KIND_LABELS;

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly rewards = signal<LoyaltyRewardView[]>([]);
  readonly services = signal<LoyaltyRewardServiceOption[]>([]);
  /** The reward being edited; null while creating a new one. */
  readonly editing = signal<LoyaltyRewardView | null>(null);
  readonly historyFor = signal<string | null>(null);
  readonly history = signal<LoyaltyRewardChangeView[]>([]);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    kind: this.formBuilder.nonNullable.control<LoyaltyRewardKind>('Other'),
    serviceId: [''],
    pointsCost: [100, [Validators.required, Validators.min(1), Validators.max(LOYALTY_MAX_POINTS_PER_ITEM)]],
    isActive: [true],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  edit(reward: LoyaltyRewardView): void {
    this.editing.set(reward);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.form.reset({
      name: reward.name,
      description: reward.description ?? '',
      kind: reward.kind,
      serviceId: reward.serviceId ?? '',
      pointsCost: reward.pointsCost,
      isActive: reward.isActive,
    });
  }

  startNew(): void {
    this.editing.set(null);
    this.form.reset({ name: '', description: '', kind: 'Other', serviceId: '', pointsCost: 100, isActive: true });
  }

  async toggleHistory(reward: LoyaltyRewardView): Promise<void> {
    if (this.historyFor() === reward.id) {
      this.historyFor.set(null);
      return;
    }

    this.historyFor.set(reward.id);
    this.history.set([]);
    try {
      this.history.set(await firstValueFrom(this.api.getRewardChanges(reward.id)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
  }

  async save(): Promise<void> {
    const value = this.form.getRawValue();
    if (this.form.invalid || !Number.isInteger(value.pointsCost) || (value.kind === 'Service' && !value.serviceId)) {
      this.form.markAllAsTouched();
      this.errorMessage.set(
        value.kind === 'Service' && !value.serviceId
          ? 'Elige el servicio que se entrega como recompensa.'
          : `Revisa el nombre y el coste: un número entero de puntos entre 1 y ${this.maxCost}.`,
      );
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const editing = this.editing();
    const request = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      kind: value.kind,
      serviceId: value.kind === 'Service' ? value.serviceId : null,
      pointsCost: value.pointsCost,
      isActive: value.isActive,
      version: editing?.version ?? null,
    };
    try {
      await firstValueFrom(editing ? this.api.updateReward(editing.id, request) : this.api.createReward(request));
      this.successMessage.set(editing ? 'Recompensa actualizada. Los canjes ya pedidos conservan sus condiciones.' : 'Recompensa creada.');
      this.startNew();
      await this.load();
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Otra persona modificó esta recompensa. Recarga la lista y vuelve a editarla.'
          : getApiErrorMessage(error),
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [rewards, services] = await Promise.all([
        firstValueFrom(this.api.getRewards()),
        firstValueFrom(this.api.getRewardServiceOptions()),
      ]);
      this.rewards.set(rewards);
      this.services.set(services);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
