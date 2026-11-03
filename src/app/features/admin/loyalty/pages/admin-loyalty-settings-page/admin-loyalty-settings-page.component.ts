import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  LOYALTY_MAX_VALIDITY_DAYS,
  LOYALTY_MIN_VALIDITY_DAYS,
  LoyaltySettingsChangeView,
  LoyaltySettingsView,
} from '../../../../../core/models/loyalty.models';
import { AdminLoyaltyApiService } from '../../../../../core/services/admin-loyalty-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const FORBIDDEN_MESSAGE = 'Ya no tienes permiso para administrar la fidelización. Si crees que es un error, pide a un administrador que revise tu rol.';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

@Component({
  selector: 'app-admin-loyalty-settings-page',
  imports: [DatePipe, ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-loyalty-settings-page.component.html',
  styleUrl: './admin-loyalty-settings-page.component.scss',
})
export class AdminLoyaltySettingsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly loyaltyApiService = inject(AdminLoyaltyApiService);

  readonly minValidityDays = LOYALTY_MIN_VALIDITY_DAYS;
  readonly maxValidityDays = LOYALTY_MAX_VALIDITY_DAYS;

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  /** Someone else saved first: the form keeps the user's values until they reload. */
  readonly hasConflict = signal(false);
  readonly settings = signal<LoyaltySettingsView | null>(null);
  readonly changes = signal<LoyaltySettingsChangeView[]>([]);
  /** The history could not be read, so "no changes yet" would be misleading. */
  readonly historyUnavailable = signal(false);
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => (this.isSubmitting() ? 'Guardando...' : 'Guardar configuración'));

  readonly form = this.formBuilder.nonNullable.group({
    isEnabled: [false],
    pointsValidityDays: [
      365,
      [
        Validators.required,
        Validators.min(LOYALTY_MIN_VALIDITY_DAYS),
        Validators.max(LOYALTY_MAX_VALIDITY_DAYS),
        integerValidator,
      ],
    ],
  });

  ngOnInit(): void {
    void this.load();
  }

  async reload(): Promise<void> {
    await this.load();
  }

  async submit(): Promise<void> {
    const current = this.settings();
    if (!current) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);
    try {
      const value = this.form.getRawValue();
      const saved = await firstValueFrom(
        this.loyaltyApiService.updateSettings({
          isEnabled: value.isEnabled,
          pointsValidityDays: value.pointsValidityDays,
          version: current.version,
        }),
      );
      this.applySettings(saved);
      this.successMessage.set(
        saved.version === current.version ? 'No había cambios para guardar.' : 'Configuración guardada.',
      );
      await this.loadChanges();
    } catch (error) {
      this.hasConflict.set(error instanceof HttpErrorResponse && error.status === 409);
      this.errorMessage.set(this.describeError(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  statusLabel(isEnabled: boolean): string {
    return isEnabled ? 'Habilitado' : 'Deshabilitado';
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.hasConflict.set(false);
    try {
      const [settings, changes] = await Promise.all([
        firstValueFrom(this.loyaltyApiService.getSettings()),
        firstValueFrom(this.loyaltyApiService.listSettingsChanges()),
      ]);
      this.applySettings(settings);
      this.changes.set(changes);
      this.historyUnavailable.set(false);
    } catch (error) {
      this.historyUnavailable.set(true);
      this.errorMessage.set(this.describeError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  /** A 403 from the permission policy carries no detail; the permission may have been revoked since sign-in. */
  private describeError(error: unknown): string {
    return error instanceof HttpErrorResponse && error.status === 403 ? FORBIDDEN_MESSAGE : getApiErrorMessage(error);
  }

  private async loadChanges(): Promise<void> {
    try {
      this.changes.set(await firstValueFrom(this.loyaltyApiService.listSettingsChanges()));
    } catch {
      // The settings were saved; a failed history refresh is not worth an error over the success message.
    }
  }

  private applySettings(settings: LoyaltySettingsView): void {
    this.settings.set(settings);
    this.hasConflict.set(false);
    this.form.reset({ isEnabled: settings.isEnabled, pointsValidityDays: settings.pointsValidityDays });
  }
}
