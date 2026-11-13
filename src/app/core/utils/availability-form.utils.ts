import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

import { UnavailablePeriod } from '../models/availability.models';
import { bogotaDateKeyFromToday, bogotaLocalToUtcIso, bogotaToday, utcToBogotaLocal } from './bogota-date.utils';

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

    // "Today" and "tomorrow" are Bogotá days, whatever the device timezone (SONDA BUG-030).
    if (isAllDay) {
      if (start <= bogotaToday()) errors['pastStart'] = true;
      if (end < start) errors['timeRange'] = true;
    } else {
      const tomorrowStart = `${bogotaDateKeyFromToday(1)}T00:00`;

      if (start < tomorrowStart) errors['pastStart'] = true;
      if (end <= start) errors['timeRange'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

export function normalizeOptional(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

/**
 * The value of a `datetime-local` input, read as Bogotá time (the shop's time), as a UTC ISO instant.
 * Using the device timezone stored the periods shifted when the browser was not in Bogotá (SONDA BUG-030).
 */
export function toUtcIsoString(value: string): string {
  return bogotaLocalToUtcIso(value);
}

/** A UTC instant as the Bogotá value of a `datetime-local` input. */
export function formatDateTimeLocal(value: string): string {
  return utcToBogotaLocal(value);
}

export function sortPeriods(periods: UnavailablePeriod[]): UnavailablePeriod[] {
  return [...periods].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
}
