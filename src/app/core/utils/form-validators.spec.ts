import { FormControl } from '@angular/forms';

import { trimmedMinLength, trimmedOrNull, trimmedRequired } from './form-validators';

/** SONDA BUG-009: ' A ' and '   ' must be caught by the form, as the server trims them. */
describe('form validators', () => {
  it('trimmedRequired rejects blanks and accepts real text', () => {
    expect(trimmedRequired(new FormControl('   '))).toEqual({ required: true });
    expect(trimmedRequired(new FormControl(''))).toEqual({ required: true });
    expect(trimmedRequired(new FormControl(null))).toEqual({ required: true });
    expect(trimmedRequired(new FormControl(' Ana '))).toBeNull();
  });

  it('trimmedMinLength counts the text without its spaces', () => {
    const validator = trimmedMinLength(2);

    expect(validator(new FormControl(' A '))).toEqual({ minlength: { requiredLength: 2, actualLength: 1 } });
    expect(validator(new FormControl(' Al '))).toBeNull();
    // Empty is the required validator's job.
    expect(validator(new FormControl('   '))).toBeNull();
  });

  it('trimmedOrNull sends trimmed text and null for an empty optional value', () => {
    expect(trimmedOrNull('  Hola ')).toBe('Hola');
    expect(trimmedOrNull('   ')).toBeNull();
    expect(trimmedOrNull(undefined)).toBeNull();
  });
});
