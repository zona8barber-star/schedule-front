import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * SONDA BUG-009: ' A ' or '   ' passed the client and the server rejected them. These validators look at the text
 * without the surrounding spaces, as the server does, so the field explains it before sending anything.
 */
export function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined) {
    return { required: true };
  }

  return typeof value === 'string' && value.trim().length === 0 ? { required: true } : null;
}

export function trimmedMinLength(minLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    // An empty value is the job of the required validator.
    if (value.length === 0 || value.length >= minLength) {
      return null;
    }

    return { minlength: { requiredLength: minLength, actualLength: value.length } };
  };
}

/** The text a form sends: without surrounding spaces; an empty optional text becomes null. */
export function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
