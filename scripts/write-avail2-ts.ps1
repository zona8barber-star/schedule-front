$dest = "d:\Proyects\barbershop\app\front\barbershop-pwa\src\app\features\staff\availability\pages\staff-availability-page\staff-availability-page.component.ts"

$content = @'
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
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
import { StaffAvailabilityApiService } from '../../../../../core/services/staff-availability-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

type TimeBlockFormGroup = FormGroup<{
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}>;

type DayRuleFormGroup = FormGroup<{
  dayOfWeek: FormControl<number>;
  isActive: FormControl<boolean>;
  blocks: FormArray<TimeBlockFormGroup>;
}>;

type AbsenceFormGroup = FormGroup<{
  isAllDay: FormControl<boolean>;
  startValue: FormControl<string>;
  endValue: FormControl<string>;
  reason: FormControl<string>;
}>;

@Component({
  selector: 'app-staff-availability-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './staff-availability-page.component.html',
  styleUrl: './staff-availability-page.component.scss',
})
export class StaffAvailabilityPageComponent {
  private readonly staffAvailabilityApiService = inject(StaffAvailabilityApiService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly dayOptions = STAFF_AVAILABILITY_DAYS;

  // ── State ──────────────────────────────────────────────────────────────
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
  readonly pageErrorMessage = signal<string | null>(null);
  readonly rulesErrorMessage = signal<string | null>(null);
  readonly rulesSuccessMessage = signal<string | null>(null);
  readonly absenceErrorMessage = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────
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
    return this.unavailablePeriods().filter(
      (p) => new Date(p.createdAtUtc).getTime() >= cutoff,
    );
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

  // ── Forms ──────────────────────────────────────────────────────────────
  readonly daysForm = new FormGroup({
    days: new FormArray<DayRuleFormGroup>(
      STAFF_AVAILABILITY_DAYS.map((d) => createDayRuleForm(d.dayOfWeek)),
    ),
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

  // ── Accessors ──────────────────────────────────────────────────────────
  get daysArray(): FormArray<DayRuleFormGroup> {
    return this.daysForm.controls.days;
  }

  blocksOf(dayIndex: number): FormArray<TimeBlockFormGroup> {
    return this.daysArray.at(dayIndex).controls.blocks;
  }

  // ── Rule methods ───────────────────────────────────────────────────────

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

  // ── Absence methods ────────────────────────────────────────────────────

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

    const confirmed = confirm(
      `Confirmar eliminacion del ausentismo:\n${this.formatPeriodWindow(period)}\n\nEsta accion no se puede deshacer.`,
    );
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

  // ── Formatting ─────────────────────────────────────────────────────────
  formatPeriodWindow(period: UnavailablePeriod): string {
    return `${this.formatTimestamp(period.startsAtUtc)} — ${this.formatTimestamp(period.endsAtUtc)}`;
  }

  formatTimestamp(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  // ── Private ────────────────────────────────────────────────────────────
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

      dayGroup.controls.isActive.setValue(dayRules.some((r) => r.isActive), { emitEvent: false });

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

// ── Factory functions ──────────────────────────────────────────────────────
function createTimeBlockForm(): TimeBlockFormGroup {
  return new FormGroup({
    startTime: new FormControl('09:00', { nonNullable: true }),
    endTime: new FormControl('17:00', { nonNullable: true }),
  });
}

function createDayRuleForm(dayOfWeek: number): DayRuleFormGroup {
  return new FormGroup({
    dayOfWeek: new FormControl(dayOfWeek, { nonNullable: true }),
    isActive: new FormControl(false, { nonNullable: true }),
    blocks: new FormArray<TimeBlockFormGroup>([createTimeBlockForm()]),
  });
}

// ── Validators ─────────────────────────────────────────────────────────────
function absenceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control as AbsenceFormGroup;
    const isAllDay = group.controls.isAllDay.value;
    const start = group.controls.startValue.value;
    const end = group.controls.endValue.value;

    if (!start || !end) return null;

    const errors: ValidationErrors = {};

    if (isAllDay) {
      // Compare date strings lexicographically ('YYYY-MM-DD')
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      if (start <= todayStr) errors['pastStart'] = true;
      if (end < start) errors['timeRange'] = true;
    } else {
      // Compare datetime-local strings ('YYYY-MM-DDTHH:MM')
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const offset = tomorrow.getTimezoneOffset() * 60_000;
      const tomorrowLocal = new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16);

      if (start < tomorrowLocal) errors['pastStart'] = true;
      if (end <= start) errors['timeRange'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────
function normalizeOptional(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

function toUtcIsoString(value: string): string {
  return new Date(value).toISOString();
}

function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function sortPeriods(periods: UnavailablePeriod[]): UnavailablePeriod[] {
  return [...periods].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
}
'@

[System.IO.File]::WriteAllText($dest, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "TS written OK"
