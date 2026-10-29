import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom, startWith } from 'rxjs';

import {
  MembershipGiftCondition,
  MembershipGiftKind,
  MembershipPlanMode,
  MembershipPlanUpsertRequest,
  MembershipPlanView,
} from '../../../../../core/models/membership-plan.models';
import { ServiceView } from '../../../../../core/models/service.models';
import { AdminMembershipPlansApiService } from '../../../../../core/services/admin-membership-plans-api.service';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import {
  DEFAULT_MEMBERSHIP_TERMS,
  GIFT_CONDITION_LABELS,
  MEMBERSHIP_MAX_DURATION_DAYS,
  MEMBERSHIP_MAX_QUANTITY,
} from '../../membership-plan-defaults';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

const quantityValidators = [Validators.required, Validators.min(1), Validators.max(MEMBERSHIP_MAX_QUANTITY), integerValidator];

interface ServiceOption {
  id: string;
  name: string;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-membership-plan-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-membership-plan-form-modal.component.html',
  styleUrl: './admin-membership-plan-form-modal.component.scss',
})
export class AdminMembershipPlanFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly membershipPlansApiService = inject(AdminMembershipPlansApiService);
  private readonly servicesApiService = inject(AdminServicesApiService);

  /** The plan being edited, or null to create a new one. */
  @Input() planId: string | null = null;
  @Output() readonly saved = new EventEmitter<MembershipPlanView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly maxQuantity = MEMBERSHIP_MAX_QUANTITY;
  readonly maxDurationDays = MEMBERSHIP_MAX_DURATION_DAYS;
  readonly conditionLabels = GIFT_CONDITION_LABELS;
  readonly conditionOptions: MembershipGiftCondition[] = ['EveryPurchase', 'FirstPurchaseOfPlan'];

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submitted = signal(false);
  /** Catalog services that can be added (active), plus any inactive one the plan already has. */
  readonly serviceOptions = signal<ServiceOption[]>([]);

  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    description: this.formBuilder.nonNullable.control('', [Validators.maxLength(1000)]),
    price: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0), integerValidator]),
    mode: this.formBuilder.nonNullable.control<MembershipPlanMode>('Pool'),
    poolQuantity: this.formBuilder.control<number | null>(10, quantityValidators),
    defaultDurationDays: this.formBuilder.nonNullable.control(30, [
      Validators.required,
      Validators.min(1),
      Validators.max(MEMBERSHIP_MAX_DURATION_DAYS),
      integerValidator,
    ]),
    terms: this.formBuilder.nonNullable.control(DEFAULT_MEMBERSHIP_TERMS, [Validators.required, Validators.maxLength(4000)]),
    specificConditions: this.formBuilder.nonNullable.control('', [Validators.maxLength(2000)]),
    services: this.formBuilder.array<FormGroup>([]),
    giftRules: this.formBuilder.array<FormGroup>([]),
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())));

  readonly isPool = computed(() => (this.formValue()?.mode ?? this.form.controls.mode.value) === 'Pool');

  /** Services already in the plan; the only ones a service gift may use. */
  readonly includedServices = computed(() => {
    this.formValue();
    const names = new Map(this.serviceOptions().map((option) => [option.id, option.name]));
    return this.servicesArray.controls.map((group) => {
      const id = group.controls['serviceId'].value as string;
      return { id, name: names.get(id) ?? '' };
    });
  });

  readonly addableServices = computed(() => {
    const included = new Set(this.includedServices().map((service) => service.id));
    return this.serviceOptions().filter((option) => option.isActive && !included.has(option.id));
  });

  /** Plan-level problems the field validators cannot express. */
  readonly planProblems = computed(() => {
    this.formValue();
    const problems: string[] = [];
    if (this.servicesArray.length === 0) {
      problems.push('Incluye al menos un servicio.');
    }
    const included = new Set(this.includedServices().map((service) => service.id));
    if (this.giftsArray.controls.some((gift) => gift.controls['kind'].value === 'Service' && !included.has(gift.controls['serviceId'].value))) {
      problems.push('Hay obsequios de servicio que no están incluidos en la membresía.');
    }
    return problems;
  });

  get isEditing(): boolean {
    return this.planId !== null;
  }

  get servicesArray(): FormArray<FormGroup> {
    return this.form.controls.services;
  }

  get giftsArray(): FormArray<FormGroup> {
    return this.form.controls.giftRules;
  }

  async ngOnInit(): Promise<void> {
    this.form.controls.mode.valueChanges.subscribe((mode) => this.applyMode(mode));

    try {
      const [catalog, plan] = await Promise.all([
        firstValueFrom(this.servicesApiService.list()),
        this.planId ? firstValueFrom(this.membershipPlansApiService.getById(this.planId)) : Promise.resolve(null),
      ]);
      this.serviceOptions.set(this.buildOptions(catalog, plan));
      if (plan) {
        this.patch(plan);
      } else {
        this.applyMode('Pool');
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  addService(serviceId: string): void {
    if (!serviceId) {
      return;
    }
    this.servicesArray.push(this.serviceGroup(serviceId, this.isPool() ? null : 1));
    // A new row must follow the current mode: in a pool plan its (hidden) quantity is not validated.
    this.applyMode(this.form.controls.mode.value);
  }

  removeService(index: number): void {
    this.servicesArray.removeAt(index);
  }

  addGift(kind: MembershipGiftKind): void {
    const firstService = this.includedServices()[0]?.id ?? '';
    this.giftsArray.push(
      this.giftGroup({
        id: null,
        kind,
        serviceId: kind === 'Service' ? firstService : '',
        description: '',
        quantity: 1,
        condition: 'EveryPurchase',
      }),
    );
  }

  removeGift(index: number): void {
    this.giftsArray.removeAt(index);
  }

  setCondition(index: number, condition: MembershipGiftCondition): void {
    const control = this.giftsArray.at(index).controls['condition'];
    control.setValue(condition);
    control.markAsDirty();
  }

  serviceName(serviceId: string): string {
    return this.serviceOptions().find((option) => option.id === serviceId)?.name ?? '';
  }

  isServiceInactive(serviceId: string): boolean {
    return this.serviceOptions().some((option) => option.id === serviceId && !option.isActive);
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.planProblems().length > 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const request = this.buildRequest();
      const result = this.planId
        ? await firstValueFrom(this.membershipPlansApiService.update(this.planId, request))
        : await firstValueFrom(this.membershipPlansApiService.create(request));
      this.saved.emit(result);
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

  buildRequest(): MembershipPlanUpsertRequest {
    const value = this.form.getRawValue();
    const pool = value.mode === 'Pool';
    return {
      name: value.name.trim(),
      description: value.description.trim() || null,
      price: Math.trunc(value.price),
      mode: value.mode,
      poolQuantity: pool ? value.poolQuantity : null,
      defaultDurationDays: Math.trunc(value.defaultDurationDays),
      terms: value.terms.trim(),
      specificConditions: value.specificConditions.trim() || null,
      services: this.servicesArray.controls.map((group) => ({
        serviceId: group.controls['serviceId'].value,
        quantity: pool ? null : group.controls['quantity'].value,
      })),
      giftRules: this.giftsArray.controls.map((group) => {
        const kind = group.controls['kind'].value as MembershipGiftKind;
        return {
          id: group.controls['id'].value,
          kind,
          serviceId: kind === 'Service' ? group.controls['serviceId'].value : null,
          description: kind === 'Physical' ? (group.controls['description'].value as string).trim() : null,
          quantity: group.controls['quantity'].value,
          condition: group.controls['condition'].value,
        };
      }),
    };
  }

  /** Pool plans have one shared quantity; per-service plans have one per service. Only the active one is validated. */
  private applyMode(mode: MembershipPlanMode): void {
    const pool = mode === 'Pool';
    const poolControl = this.form.controls.poolQuantity;
    if (pool) {
      poolControl.enable({ emitEvent: false });
    } else {
      poolControl.disable({ emitEvent: false });
    }

    for (const group of this.servicesArray.controls) {
      const quantity = group.controls['quantity'];
      if (pool) {
        quantity.disable({ emitEvent: false });
      } else {
        if (quantity.value === null) {
          quantity.setValue(1, { emitEvent: false });
        }
        quantity.enable({ emitEvent: false });
      }
    }
    this.form.updateValueAndValidity();
  }

  private patch(plan: MembershipPlanView): void {
    this.form.patchValue(
      {
        name: plan.name,
        description: plan.description ?? '',
        price: plan.price,
        mode: plan.mode,
        poolQuantity: plan.poolQuantity ?? 10,
        defaultDurationDays: plan.defaultDurationDays,
        terms: plan.terms,
        specificConditions: plan.specificConditions ?? '',
      },
      { emitEvent: false },
    );
    for (const service of plan.services) {
      this.servicesArray.push(this.serviceGroup(service.serviceId, service.quantity));
    }
    for (const gift of plan.giftRules) {
      this.giftsArray.push(
        this.giftGroup({
          id: gift.id,
          kind: gift.kind,
          serviceId: gift.serviceId ?? '',
          description: gift.description ?? '',
          quantity: gift.quantity,
          condition: gift.condition,
        }),
      );
    }
    this.applyMode(plan.mode);
  }

  private buildOptions(catalog: ServiceView[], plan: MembershipPlanView | null): ServiceOption[] {
    const options = catalog.map((service) => ({ id: service.id, name: service.name, isActive: service.isActive }));
    // Keep services the plan already has even if they are no longer in the active catalog.
    for (const service of plan?.services ?? []) {
      if (!options.some((option) => option.id === service.serviceId)) {
        options.push({ id: service.serviceId, name: service.serviceName, isActive: false });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private serviceGroup(serviceId: string, quantity: number | null): FormGroup {
    return this.formBuilder.group({
      serviceId: this.formBuilder.nonNullable.control(serviceId),
      quantity: this.formBuilder.control<number | null>(quantity, quantityValidators),
    });
  }

  private giftGroup(gift: {
    id: string | null;
    kind: MembershipGiftKind;
    serviceId: string;
    description: string;
    quantity: number;
    condition: MembershipGiftCondition;
  }): FormGroup {
    const isService = gift.kind === 'Service';
    return this.formBuilder.group({
      id: this.formBuilder.control<string | null>(gift.id),
      kind: this.formBuilder.nonNullable.control<MembershipGiftKind>(gift.kind),
      serviceId: this.formBuilder.nonNullable.control(gift.serviceId, isService ? [Validators.required] : []),
      description: this.formBuilder.nonNullable.control(
        gift.description,
        isService ? [] : [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
      ),
      quantity: this.formBuilder.nonNullable.control(gift.quantity, quantityValidators),
      condition: this.formBuilder.nonNullable.control<MembershipGiftCondition>(gift.condition),
    });
  }
}
