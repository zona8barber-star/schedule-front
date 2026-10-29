import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CustomerMembershipDetailView } from '../../../../../core/models/membership.models';
import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { AdminMembershipPlansApiService } from '../../../../../core/services/admin-membership-plans-api.service';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { GIFT_CONDITION_LABELS } from '../../../membership-plans/membership-plan-defaults';
import { bogotaToday, defaultEndsOn } from '../../membership-labels';

const REASON_MIN_LENGTH = 3;

/** Sells a membership to one customer; first-purchase gifts are evaluated by the server when saving. */
@Component({
  selector: 'app-admin-membership-sell-modal',
  imports: [FormsModule, DecimalPipe, ApiFeedbackComponent],
  templateUrl: './admin-membership-sell-modal.component.html',
  styleUrl: '../membership-modal.scss',
})
export class AdminMembershipSellModalComponent implements OnInit {
  private readonly plansApi = inject(AdminMembershipPlansApiService);
  private readonly membershipsApi = inject(AdminMembershipsApiService);

  @Input({ required: true }) customerId!: string;
  @Input({ required: true }) customerName!: string;
  @Output() readonly sold = new EventEmitter<CustomerMembershipDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly conditionLabels = GIFT_CONDITION_LABELS;
  readonly today = bogotaToday();

  readonly plans = signal<MembershipPlanView[]>([]);
  readonly planId = signal('');
  readonly soldOn = signal(this.today);
  readonly startsOn = signal(this.today);
  readonly endsOn = signal('');
  /** Until the admin edits the end date, it follows the start date and the plan's duration. */
  readonly endsOnEdited = signal(false);
  readonly activateNow = signal(false);
  readonly confirmExpired = signal(false);
  readonly activationReason = signal('');
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly plan = computed(() => this.plans().find((candidate) => candidate.id === this.planId()) ?? null);
  readonly isExpiredActivation = computed(() => this.activateNow() && !!this.endsOn() && this.endsOn() < this.today);

  readonly problems = computed(() => {
    const problems: string[] = [];
    if (!this.plan()) problems.push('Elige un tipo de membresía.');
    if (!this.startsOn()) problems.push('Indica la fecha de inicio.');
    if (this.endsOn() && this.startsOn() && this.endsOn() < this.startsOn()) {
      problems.push('La fecha de vencimiento no puede ser anterior a la de inicio.');
    }
    if (this.soldOn() > this.today) problems.push('La fecha de venta no puede ser futura.');
    if (this.isExpiredActivation()) {
      if (!this.confirmExpired()) problems.push('Confirma la activación excepcional de una membresía vencida.');
      if (this.activationReason().trim().length < REASON_MIN_LENGTH) problems.push('Explica por qué se activa vencida.');
    }
    return problems;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set((await firstValueFrom(this.plansApi.list())).filter((plan) => plan.isActive));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  onPlanChange(planId: string): void {
    this.planId.set(planId);
    this.recomputeEndsOn();
  }

  onStartsOnChange(startsOn: string): void {
    this.startsOn.set(startsOn);
    this.recomputeEndsOn();
  }

  onEndsOnChange(endsOn: string): void {
    this.endsOn.set(endsOn);
    this.endsOnEdited.set(true);
  }

  resetEndsOn(): void {
    this.endsOnEdited.set(false);
    this.recomputeEndsOn();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    const plan = this.plan();
    if (!plan || this.problems().length > 0) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const expired = this.isExpiredActivation();
      const result = await firstValueFrom(
        this.membershipsApi.sell(this.customerId, {
          planId: plan.id,
          startsOn: this.startsOn(),
          endsOn: this.endsOn() || null,
          soldOn: this.soldOn(),
          activateNow: this.activateNow(),
          confirmExpiredActivation: expired && this.confirmExpired(),
          activationReason: expired ? this.activationReason().trim() : null,
        }),
      );
      this.sold.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isSaving()) {
      return;
    }
    this.cancelled.emit();
  }

  private recomputeEndsOn(): void {
    const plan = this.plan();
    if (!this.endsOnEdited() && plan && this.startsOn()) {
      this.endsOn.set(defaultEndsOn(this.startsOn(), plan.defaultDurationDays));
    }
  }
}
