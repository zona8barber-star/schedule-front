import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CustomerMembershipDetailView } from '../../../../../core/models/membership.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { bogotaToday } from '../../membership-labels';

/** What a service can still use: gifted units first, then purchased ones. */
interface ServiceBalance {
  serviceId: string;
  serviceName: string;
  gifted: number;
  purchased: number;
}

/**
 * Registers that services of an active membership were given. The server re-checks every rule and the
 * balance; this modal only previews them. One key per opened modal makes a retried save count once.
 */
@Component({
  selector: 'app-admin-membership-consume-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-membership-consume-modal.component.html',
  styleUrl: '../membership-modal.scss',
})
export class AdminMembershipConsumeModalComponent implements OnInit {
  private readonly membershipsApi = inject(AdminMembershipsApiService);
  private readonly staffApi = inject(AdminStaffApiService);

  @Input({ required: true }) membership!: CustomerMembershipDetailView;
  @Output() readonly consumed = new EventEmitter<CustomerMembershipDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly idempotencyKey = crypto.randomUUID();
  readonly today = bogotaToday();

  readonly staff = signal<StaffListItem[]>([]);
  readonly serviceId = signal('');
  readonly quantity = signal<number | null>(1);
  readonly serviceDate = signal('');
  readonly staffProfileId = signal('');
  readonly isSaving = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly balances = computed<ServiceBalance[]>(() => {
    const byService = new Map<string, ServiceBalance>();
    for (const line of this.membership.allowances) {
      for (const service of line.services) {
        const balance = byService.get(service.serviceId) ?? {
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          gifted: 0,
          purchased: 0,
        };
        if (line.origin === 'Gift') {
          balance.gifted += line.availableQuantity;
        } else {
          balance.purchased += line.availableQuantity;
        }
        byService.set(service.serviceId, balance);
      }
    }
    return [...byService.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  });

  readonly selected = computed(() => this.balances().find((balance) => balance.serviceId === this.serviceId()) ?? null);

  /** Last day a service can be dated: the end of the validity, or today if it has not ended yet. */
  readonly maxDate = computed(() => (this.membership.endsOn < this.today ? this.membership.endsOn : this.today));

  readonly split = computed(() => {
    const balance = this.selected();
    const quantity = this.quantity() ?? 0;
    if (!balance || quantity < 1) return null;
    const gifted = Math.min(quantity, balance.gifted);
    return { gifted, purchased: Math.min(quantity - gifted, balance.purchased) };
  });

  readonly problems = computed(() => {
    const problems: string[] = [];
    const balance = this.selected();
    const quantity = this.quantity();
    if (!balance) problems.push('Elige el servicio que se prestó.');
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      problems.push('La cantidad debe ser un número entero mayor que cero.');
    } else if (balance && quantity > balance.gifted + balance.purchased) {
      problems.push(`Saldo insuficiente: quedan ${balance.gifted + balance.purchased} para ${balance.serviceName}.`);
    }
    const date = this.serviceDate();
    if (!date) {
      problems.push('Indica la fecha real del servicio.');
    } else if (date > this.today) {
      problems.push('La fecha del servicio no puede ser futura.');
    } else if (date < this.membership.startsOn || date > this.membership.endsOn) {
      problems.push(`La fecha debe estar dentro de la vigencia (${this.membership.startsOn} al ${this.membership.endsOn}).`);
    }
    return problems;
  });

  async ngOnInit(): Promise<void> {
    this.serviceDate.set(this.maxDate());
    if (this.balances().length === 1) {
      this.serviceId.set(this.balances()[0].serviceId);
    }
    try {
      this.staff.set((await firstValueFrom(this.staffApi.list())).filter((member) => member.isActive));
    } catch {
      // The professional is optional; without the list the consumption can still be registered.
      this.staff.set([]);
    }
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.problems().length > 0) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.membershipsApi.consume(this.membership.id, {
          serviceId: this.serviceId(),
          quantity: this.quantity()!,
          serviceDate: this.serviceDate(),
          staffProfileId: this.staffProfileId() || null,
          idempotencyKey: this.idempotencyKey,
        }),
      );
      this.consumed.emit(result);
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
}
