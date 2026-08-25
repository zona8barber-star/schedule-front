import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  AvailabilityRule,
  AvailabilityRuleUpsertRequest,
  AvailabilitySummary,
  CreateUnavailablePeriodRequest,
  STAFF_AVAILABILITY_DAYS,
  UnavailablePeriod,
  UpdateUnavailablePeriodRequest,
} from '../../../../../core/models/availability.models';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { StaffAvailabilityApiService } from '../../../../../core/services/staff-availability-api.service';
import { StaffProfileApiService } from '../../../../../core/services/staff-profile-api.service';
import {
  AbsenceFormGroup,
  DayRuleFormGroup,
  TimeBlockFormGroup,
  absenceValidator,
  createDayRuleForm,
  createTimeBlockForm,
  formatDateTimeLocal,
  normalizeOptional,
  sortPeriods,
  toUtcIsoString,
} from '../../../../../core/utils/availability-form.utils';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-staff-availability-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './staff-availability-page.component.html',
  styleUrl: '../../../../../shared/styles/availability-page.scss',
})
export class StaffAvailabilityPageComponent {
  private readonly staffAvailabilityApiService = inject(StaffAvailabilityApiService);
  private readonly staffProfileApiService = inject(StaffProfileApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly dayOptions = STAFF_AVAILABILITY_DAYS;

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly activeTab = signal<'availability' | 'absences'>('availability');
  readonly showAbsenceModal = signal(false);
  readonly summary = signal<AvailabilitySummary | null>(null);
  readonly unavailablePeriods = signal<UnavailablePeriod[]>([]);
  readonly isLoading = signal(true);
  readonly isSavingRules = signal(false);
  readonly isSavingAbsence = signal(false);
  readonly deletingAbsenceId = signal<string | null>(null);
  readonly editingAbsenceId = signal<string | null>(null);
  readonly rulesSubmitted = signal(false);
  readonly absenceSubmitted = signal(false);
  readonly editingDuration = signal(false);
  readonly isSavingDuration = signal(false);
  readonly pageErrorMessage = signal<string | null>(null);
  readonly rulesErrorMessage = signal<string | null>(null);
  readonly rulesSuccessMessage = signal<string | null>(null);
  readonly absenceErrorMessage = signal<string | null>(null);
  readonly durationErrorMessage = signal<string | null>(null);

  // â”€â”€ Computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly isRulesBusy = computed(() => this.isLoading() || this.isSavingRules());
  readonly isAbsenceBusy = computed(
    () => this.isLoading() || this.isSavingAbsence() || this.deletingAbsenceId() !== null,
  );
  readonly rulesSubmitLabel = computed(() =>
    this.isSavingRules() ? 'Guardando...' : 'Guardar disponibilidad',
  );
  readonly absenceSubmitLabel = computed(() => {
    if (this.isSavingAbsence()) {
      return this.editingAbsenceId() ? 'Actualizando...' : 'Guardando...';
    }
    return this.editingAbsenceId() ? 'Actualizar ausentismo' : 'Registrar ausentismo';
  });

  readonly durationWarning = computed(() => {
    const d = this.summary()?.defaultAppointmentDurationMinutes ?? 0;
    return d <= 0
      ? 'La duracion base de citas es 0. Actualizala en Mi Perfil para que los turnos se calculen correctamente.'
      : null;
  });

  readonly recentAbsences = computed(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    return this.unavailablePeriods().filter((p) => new Date(p.createdAtUtc).getTime() >= cutoff);
  });

  // Min date/datetime for absence form (tomorrow, not today)
  readonly minStartDate: string = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  get minStartDatetime(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const offset = tomorrow.getTimezoneOffset() * 60_000;
    return new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16);
  }

  // â”€â”€ Forms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly daysForm = new FormGroup({
    days: new FormArray<DayRuleFormGroup>(
      STAFF_AVAILABILITY_DAYS.map((d) => createDayRuleForm(d.dayOfWeek)),
    ),
  });

  readonly durationControl = new FormControl<number>(30, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(5), Validators.max(480)],
  });

  readonly absenceForm: AbsenceFormGroup = new FormGroup(
    {
      isAllDay: new FormControl(false, { nonNullable: true }),
      startValue: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endValue: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    },
    { validators: [absenceValidator()] },
  );

  constructor() {
    void this.loadAvailability();
  }

  // â”€â”€ Accessors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  get daysArray(): FormArray<DayRuleFormGroup> {
    return this.daysForm.controls.days;
  }

  blocksOf(dayIndex: number): FormArray<TimeBlockFormGroup> {
    return this.daysArray.at(dayIndex).controls.blocks;
  }

  // Duration edit

  startEditDuration(): void {
    this.durationControl.setValue(this.summary()?.defaultAppointmentDurationMinutes ?? 30);
    this.durationErrorMessage.set(null);
    this.editingDuration.set(true);
  }

  cancelEditDuration(): void {
    this.editingDuration.set(false);
    this.durationErrorMessage.set(null);
  }

  async saveDuration(): Promise<void> {
    this.durationControl.markAsTouched();
    if (this.durationControl.invalid) return;

    this.isSavingDuration.set(true);
    this.durationErrorMessage.set(null);

    try {
      const profile = await firstValueFrom(this.staffProfileApiService.getCurrent());
      const updated = await firstValueFrom(
        this.staffProfileApiService.updateCurrent({
          displayName: profile.displayName,
          bio: profile.bio,
          phoneNumber: profile.phoneNumber,
          defaultAppointmentDurationMinutes: this.durationControl.value,
          photoMediaAssetId: profile.photoMediaAssetId,
          tipsQrMediaAssetId: profile.tipsQrMediaAssetId,
          instagramUrl: profile.instagramUrl,
          facebookUrl: profile.facebookUrl,
          tikTokUrl: profile.tikTokUrl,
          youtubeUrl: profile.youtubeUrl,
          xUrl: profile.xUrl,
        }),
      );

      const s = this.summary();
      if (s) {
        this.summary.set({
          ...s,
          defaultAppointmentDurationMinutes: updated.defaultAppointmentDurationMinutes,
        });
      }
      this.cancelEditDuration();
    } catch (error) {
      this.durationErrorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSavingDuration.set(false);
    }
  }

  // â”€â”€ Rule methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Normal method (not computed) so it re-evaluates on every change detection
   *  when Angular re-renders the template. */
  hasRulesErrors(): boolean {
    for (const dayGroup of this.daysArray.controls) {
      if (!dayGroup.controls.isActive.value) continue;
      for (const block of dayGroup.controls.blocks.controls) {
        const { startTime, endTime } = block.getRawValue();
        if (!startTime || !endTime) return true;
        if (endTime <= startTime) return true;
      }
    }
    return false;
  }

  addBlock(dayIndex: number): void {
    this.blocksOf(dayIndex).push(createTimeBlockForm());
  }

  removeBlock(dayIndex: number, blockIndex: number): void {
    const blocks = this.blocksOf(dayIndex);
    if (blocks.length > 1) {
      blocks.removeAt(blockIndex);
    }
  }

  getActiveDaysCount(): number {
    return this.daysArray.controls.filter((g) => g.controls.isActive.value).length;
  }

  showBlockError(
    dayIndex: number,
    blockIndex: number,
    errorName: 'requiredTime' | 'timeRange',
  ): boolean {
    if (!this.rulesSubmitted()) return false;
    if (!this.daysArray.at(dayIndex).controls.isActive.value) return false;
    const { startTime, endTime } = this.blocksOf(dayIndex).at(blockIndex).getRawValue();
    if (errorName === 'requiredTime') return !startTime || !endTime;
    if (errorName === 'timeRange') return !!startTime && !!endTime && endTime <= startTime;
    return false;
  }

  async saveRules(): Promise<void> {
    this.rulesSubmitted.set(true);
    this.rulesErrorMessage.set(null);
    this.rulesSuccessMessage.set(null);

    if (this.hasRulesErrors()) {
      return;
    }

    this.isSavingRules.set(true);

    try {
      const request: AvailabilityRuleUpsertRequest[] = [];
      for (const dayGroup of this.daysArray.controls) {
        const { dayOfWeek, isActive, blocks } = dayGroup.getRawValue();
        if (!isActive) continue;
        for (const block of blocks) {
          request.push({
            dayOfWeek,
            startTime: block.startTime,
            endTime: block.endTime,
            isActive: true,
          });
        }
      }

      const rules = await firstValueFrom(
        this.staffAvailabilityApiService.updateWeeklyRules(request),
      );

      const currentSummary = this.summary();
      if (currentSummary) {
        const updated: AvailabilitySummary = { ...currentSummary, rules };
        this.summary.set(updated);
        this.applySummaryToRules(updated);
      }

      this.rulesSuccessMessage.set('Tu disponibilidad semanal se guardo correctamente.');
    } catch (error) {
      this.rulesErrorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSavingRules.set(false);
    }
  }

  // â”€â”€ Absence methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  isAbsencePast(period: UnavailablePeriod): boolean {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return new Date(period.startsAtUtc) < todayStart;
  }

  openAbsenceModal(period?: UnavailablePeriod): void {
    this.absenceSubmitted.set(false);
    this.absenceErrorMessage.set(null);

    if (period) {
      this.editingAbsenceId.set(period.id);
      this.absenceForm.patchValue({
        isAllDay: false,
        startValue: formatDateTimeLocal(period.startsAtUtc),
        endValue: formatDateTimeLocal(period.endsAtUtc),
        reason: period.reason ?? '',
      });
    } else {
      this.editingAbsenceId.set(null);
      this.absenceForm.reset(
        { isAllDay: false, startValue: '', endValue: '', reason: '' },
        { emitEvent: false },
      );
    }

    this.showAbsenceModal.set(true);
  }

  closeAbsenceModal(): void {
    this.showAbsenceModal.set(false);
    this.editingAbsenceId.set(null);
    this.absenceForm.reset(
      { isAllDay: false, startValue: '', endValue: '', reason: '' },
      { emitEvent: false },
    );
  }

  onAllDayChange(): void {
    this.absenceForm.patchValue({ startValue: '', endValue: '' });
  }

  async submitAbsence(): Promise<void> {
    this.absenceSubmitted.set(true);
    this.absenceErrorMessage.set(null);

    if (this.absenceForm.invalid) {
      this.absenceForm.markAllAsTouched();
      return;
    }

    this.isSavingAbsence.set(true);

    const formValue = this.absenceForm.getRawValue();
    let startsAtUtc: string;
    let endsAtUtc: string;

    if (formValue.isAllDay) {
      startsAtUtc = toUtcIsoString(formValue.startValue + 'T00:00');
      endsAtUtc = toUtcIsoString(formValue.endValue + 'T23:59');
    } else {
      startsAtUtc = toUtcIsoString(formValue.startValue);
      endsAtUtc = toUtcIsoString(formValue.endValue);
    }

    const request = {
      startsAtUtc,
      endsAtUtc,
      reason: normalizeOptional(formValue.reason),
    } satisfies CreateUnavailablePeriodRequest & UpdateUnavailablePeriodRequest;

    try {
      const editingId = this.editingAbsenceId();
      if (editingId) {
        await firstValueFrom(
          this.staffAvailabilityApiService.updateUnavailablePeriod(editingId, request),
        );
      } else {
        await firstValueFrom(this.staffAvailabilityApiService.createUnavailablePeriod(request));
      }

      await this.refreshUnavailablePeriods();
      this.closeAbsenceModal();
    } catch (error) {
      this.absenceErrorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSavingAbsence.set(false);
    }
  }

  async deleteAbsence(period: UnavailablePeriod): Promise<void> {
    if (this.isAbsencePast(period)) return;

    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar ausentismo',
      message: this.formatPeriodWindow(period),
    });
    if (!confirmed) return;

    this.absenceErrorMessage.set(null);
    this.deletingAbsenceId.set(period.id);

    try {
      await firstValueFrom(this.staffAvailabilityApiService.deleteUnavailablePeriod(period.id));
      await this.refreshUnavailablePeriods();
    } catch (error) {
      this.absenceErrorMessage.set(getApiErrorMessage(error));
    } finally {
      this.deletingAbsenceId.set(null);
    }
  }

  showAbsenceControlError(
    controlName: 'startValue' | 'endValue' | 'reason',
    errorName: string,
  ): boolean {
    const control = this.absenceForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.absenceSubmitted());
  }

  showAbsenceGroupError(errorName: 'timeRange' | 'pastStart'): boolean {
    return (
      !!this.absenceForm.errors?.[errorName] &&
      (this.absenceForm.touched || this.absenceSubmitted())
    );
  }

  // â”€â”€ Formatting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  formatPeriodWindow(period: UnavailablePeriod): string {
    return `${this.formatTimestamp(period.startsAtUtc)} â€” ${this.formatTimestamp(period.endsAtUtc)}`;
  }

  formatTimestamp(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  // â”€â”€ Private â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async loadAvailability(): Promise<void> {
    this.isLoading.set(true);
    this.pageErrorMessage.set(null);

    try {
      const [summary, periods] = await Promise.all([
        firstValueFrom(this.staffAvailabilityApiService.getAvailabilitySummary()),
        firstValueFrom(this.staffAvailabilityApiService.listUnavailablePeriods()),
      ]);

      const sorted = sortPeriods(periods);
      const normalized: AvailabilitySummary = { ...summary, unavailablePeriods: sorted };
      this.summary.set(normalized);
      this.unavailablePeriods.set(sorted);
      this.applySummaryToRules(normalized);
    } catch (error) {
      this.pageErrorMessage.set(getApiErrorMessage(error));
      this.summary.set(null);
      this.unavailablePeriods.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async refreshUnavailablePeriods(): Promise<void> {
    const sorted = sortPeriods(
      await firstValueFrom(this.staffAvailabilityApiService.listUnavailablePeriods()),
    );
    this.unavailablePeriods.set(sorted);
    const s = this.summary();
    if (s) this.summary.set({ ...s, unavailablePeriods: sorted });
  }

  private applySummaryToRules(summary: AvailabilitySummary): void {
    const rulesByDay = new Map<number, AvailabilityRule[]>();
    for (const rule of summary.rules) {
      const arr = rulesByDay.get(rule.dayOfWeek) ?? [];
      arr.push(rule);
      rulesByDay.set(rule.dayOfWeek, arr);
    }

    for (let i = 0; i < this.daysArray.length; i++) {
      const dayGroup = this.daysArray.at(i);
      const dayOfWeek = dayGroup.controls.dayOfWeek.value;
      const dayRules = rulesByDay.get(dayOfWeek) ?? [];

      dayGroup.controls.isActive.setValue(
        dayRules.some((r) => r.isActive),
        { emitEvent: false },
      );

      const blocksArray = dayGroup.controls.blocks;
      blocksArray.clear({ emitEvent: false });

      if (dayRules.length > 0) {
        for (const rule of dayRules) {
          const block = createTimeBlockForm();
          block.patchValue(
            { startTime: rule.startTime, endTime: rule.endTime },
            { emitEvent: false },
          );
          blocksArray.push(block, { emitEvent: false });
        }
      } else {
        blocksArray.push(createTimeBlockForm(), { emitEvent: false });
      }

      dayGroup.markAsPristine();
      dayGroup.markAsUntouched();
    }

    this.rulesSubmitted.set(false);
  }
}
