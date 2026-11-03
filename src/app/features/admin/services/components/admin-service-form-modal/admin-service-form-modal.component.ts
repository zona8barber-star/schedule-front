import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import { LOYALTY_MAX_POINTS_PER_ITEM } from '../../../../../core/models/loyalty.models';
import { ServiceView } from '../../../../../core/models/service.models';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

@Component({
  selector: 'app-admin-service-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-service-form-modal.component.html',
  styleUrl: './admin-service-form-modal.component.scss',
})
export class AdminServiceFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminServicesApiService = inject(AdminServicesApiService);
  private readonly authService = inject(AuthService);

  @Input() serviceId: string | null = null;
  @Output() readonly saved = new EventEmitter<ServiceView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isBusy = computed(() => this.isSaving() || this.isLoading());
  readonly maxLoyaltyPoints = LOYALTY_MAX_POINTS_PER_ITEM;
  /** Without the permission the points are shown read-only and never sent, so the API keeps them. */
  readonly canManageLoyalty = this.authService.hasPermission(PERMISSION_CODES.loyaltySettingsManage);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    basePrice: [0, [Validators.required, Validators.min(0), integerValidator]],
    businessPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100), integerValidator]],
    loyaltyPoints: [
      { value: 0, disabled: !this.canManageLoyalty },
      [Validators.required, Validators.min(0), Validators.max(LOYALTY_MAX_POINTS_PER_ITEM), integerValidator],
    ],
  });

  get isEditing(): boolean {
    return this.serviceId !== null;
  }

  async ngOnInit(): Promise<void> {
    if (!this.serviceId) {
      return;
    }

    this.isLoading.set(true);
    try {
      const service = await firstValueFrom(this.adminServicesApiService.getById(this.serviceId));
      this.form.patchValue({
        name: service.name,
        basePrice: service.basePrice,
        businessPercentage: service.businessPercentage,
        loyaltyPoints: service.loyaltyPoints,
      });
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload = {
      name: this.form.controls.name.value.trim(),
      basePrice: Math.trunc(this.form.controls.basePrice.value),
      businessPercentage: Math.trunc(this.form.controls.businessPercentage.value),
      ...(this.canManageLoyalty ? { loyaltyPoints: Math.trunc(this.form.controls.loyaltyPoints.value) } : {}),
    };

    try {
      const result = this.serviceId
        ? await firstValueFrom(this.adminServicesApiService.update(this.serviceId, payload))
        : await firstValueFrom(this.adminServicesApiService.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isBusy()) {
      return;
    }
    this.cancelled.emit();
  }
}
