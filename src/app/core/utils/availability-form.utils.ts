import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

import { UnavailablePeriod } from '../models/availability.models';

export type TimeBlockFormGroup = FormGroup<{
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}>;

export type DayRuleFormGroup = FormGroup<{
  dayOfWeek: FormControl<number>;
  isActive: FormControl<boolean>;
  blocks: FormArray<TimeBlockFormGroup>;
}>;

export type AbsenceFormGroup = FormGroup<{
  isAllDay: FormControl<boolean>;
  startValue: FormControl<string>;
  endValue: FormControl<string>;
  reason: FormControl<string>;
}>;

export function createTimeBlockForm(): TimeBlockFormGroup {
  return new FormGroup({
    startTime: new FormControl('09:00', { nonNullable: true }),
    endTime: new FormControl('17:00', { nonNullable: true }),
  });
}

export function createDayRuleForm(dayOfWeek: number): DayRuleFormGroup {
  return new FormGroup({
    dayOfWeek: new FormControl(dayOfWeek, { nonNullable: true }),
    isActive: new FormControl(false, { nonNullable: true }),
    blocks: new FormArray<TimeBlockFormGroup>([createTimeBlockForm()]),
  });
}

export function absenceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const group = control as AbsenceFormGroup;
    const isAllDay = group.controls.isAllDay.value;
    const start = group.controls.startValue.value;
    const end = group.controls.endValue.value;

    if (!start || !end) return null;

    const errors: ValidationErrors = {};

    if (isAllDay) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      if (start <= todayStr) errors['pastStart'] = true;
      if (end < start) errors['timeRange'] = true;
    } else {
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

export function normalizeOptional(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

export function toUtcIsoString(value: string): string {
  return new Date(value).toISOString();
}

export function formatDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function sortPeriods(periods: UnavailablePeriod[]): UnavailablePeriod[] {
  return [...periods].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
}
