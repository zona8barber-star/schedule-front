import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { BusinessScheduleResponse } from '../../../../../core/models/content.models';
import { AdminContentApiService } from '../../../../../core/services/admin-content-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'app-admin-business-hours-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-business-hours-page.component.html',
  styleUrl: './admin-business-hours-page.component.scss',
})
export class AdminBusinessHoursPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminContentApiService = inject(AdminContentApiService);

  readonly dayLabels = DAY_LABELS;
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => (this.isSubmitting() ? 'Guardando...' : 'Guardar horario'));

  readonly scheduleForm = this.formBuilder.group({
    days: this.formBuilder.array(
      Array.from({ length: 7 }, () =>
        this.formBuilder.group({
          isOpen: [false as boolean],
          openTime: ['09:00'],
          closeTime: ['19:00'],
        }),
      ),
    ),
  });

  get daysArray(): FormArray {
    return this.scheduleForm.controls.days;
  }

  ngOnInit(): void {
    void this.load();
  }

  isOpenAt(index: number): boolean {
    return (this.daysArray.at(index).get('isOpen')?.value as boolean | null) ?? false;
  }

  async submit(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const raw = this.scheduleForm.getRawValue();

    const missingTime = raw.days
      .map((day, i) => ({ ...day, i }))
      .filter((day) => day.isOpen && (!day.openTime || !day.closeTime))
      .map((day) => DAY_LABELS[day.i]);

    if (missingTime.length) {
      this.errorMessage.set(`Ingresa hora de apertura y cierre para: ${missingTime.join(', ')}.`);
      return;
    }

    this.isSubmitting.set(true);
    try {
      await firstValueFrom(
        this.adminContentApiService.updateBusinessSchedule({
          days: raw.days.map((day, i) => ({
            dayOfWeek: i,
            isOpen: day.isOpen ?? false,
            openTime: day.isOpen ? (day.openTime ?? null) : null,
            closeTime: day.isOpen ? (day.closeTime ?? null) : null,
          })),
        }),
      );
      this.successMessage.set('Horario guardado.');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const schedule = await firstValueFrom(this.adminContentApiService.getBusinessSchedule());
      this.applyToForm(schedule);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyToForm(schedule: BusinessScheduleResponse): void {
    for (const day of schedule.days) {
      const group = this.daysArray.at(day.dayOfWeek);
      if (group) {
        group.patchValue(
          {
            isOpen: day.isOpen,
            openTime: day.openTime ?? '09:00',
            closeTime: day.closeTime ?? '19:00',
          },
          { emitEvent: false },
        );
      }
    }
  }
}
