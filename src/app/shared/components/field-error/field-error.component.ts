import { Component, inject, input } from '@angular/core';
import { AbstractControl, ControlContainer, FormGroupDirective, ValidationErrors } from '@angular/forms';

export type FieldErrorKind = 'required' | 'minlength' | 'maxlength' | 'email';

/**
 * SONDA BUG-008 / BUG-027: a field over its limit left the form invalid without saying why. Placed next to an input
 * inside its `formGroup`, it shows the field's error in Spanish once the field was touched or the form was submitted.
 * By default it only reports the length limit, so it adds nothing where the form already explains the other errors.
 */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="field-error" role="alert" data-testid="field-error">{{ text }}</p>
    }
  `,
  styles: `
    .field-error {
      margin: 0.25rem 0 0;
      color: var(--color-error, #b4533c);
      font-size: 0.82rem;
      line-height: 1.4;
    }
  `,
})
export class FieldErrorComponent {
  private readonly container = inject(ControlContainer, { optional: true });

  /** Name of the control in the enclosing form group. */
  readonly controlName = input.required<string>();
  /** Which errors this field reports. */
  readonly kinds = input<readonly FieldErrorKind[]>(['maxlength']);

  message(): string | null {
    const control = this.container?.control?.get(this.controlName()) ?? null;
    if (!control || !control.errors || !this.shouldShow(control)) {
      return null;
    }

    return fieldErrorMessage(control.errors, this.kinds());
  }

  private shouldShow(control: AbstractControl): boolean {
    const submitted = (this.container?.formDirective as FormGroupDirective | null)?.submitted ?? false;
    return control.touched || control.dirty || submitted;
  }
}

/** Spanish text of the first error among `kinds`. */
export function fieldErrorMessage(errors: ValidationErrors, kinds: readonly FieldErrorKind[]): string | null {
  for (const kind of kinds) {
    const error = errors[kind];
    if (!error) continue;

    switch (kind) {
      case 'required':
        return 'Este dato es obligatorio.';
      case 'minlength':
        return `Debe tener al menos ${error.requiredLength} caracteres.`;
      case 'maxlength':
        return `Puede tener como máximo ${error.requiredLength} caracteres (ahora tiene ${error.actualLength}).`;
      case 'email':
        return 'Escribe un correo válido.';
    }
  }

  return null;
}
