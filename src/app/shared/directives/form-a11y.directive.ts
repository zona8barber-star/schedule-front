import { Directive, ElementRef, afterEveryRender, inject } from '@angular/core';
import { FormGroupDirective } from '@angular/forms';

const FIELD_SELECTOR = 'input[formcontrolname], select[formcontrolname], textarea[formcontrolname]';
const ERROR_SELECTOR = '[class*="__error"], .field-error';
let nextErrorId = 1;

/**
 * SONDA BUG-010: on a reactive form, the field errors are announced and the focus goes to the first wrong field.
 * After every render each invalid field (touched, or the form was submitted) gets aria-invalid="true" and an
 * aria-describedby pointing at its visible error messages; submitting an invalid form moves the focus to the
 * first invalid field instead of leaving it on the button.
 */
@Directive({
  selector: 'form[formGroup][appFormA11y]',
  host: {
    '(submit)': 'onSubmit()',
  },
})
export class FormA11yDirective {
  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly formGroupDirective = inject(FormGroupDirective);

  constructor() {
    afterEveryRender(() => this.update());
  }

  onSubmit(): void {
    // After Angular marked the controls and rendered their messages.
    setTimeout(() => {
      this.update();
      if (this.formGroupDirective.form.invalid) {
        this.fields().find((field) => field.classList.contains('ng-invalid'))?.focus();
      }
    });
  }

  private update(): void {
    const submitted = this.formGroupDirective.submitted;
    for (const field of this.fields()) {
      const invalid = field.classList.contains('ng-invalid') && (submitted || field.classList.contains('ng-touched'));
      if (invalid) {
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-invalid');
      }

      const errorIds = invalid ? this.errorsOf(field).map((error) => this.idOf(error)) : [];
      const own = (field.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((id) => id && !id.startsWith('form-error-'));
      const describedBy = [...own, ...errorIds].join(' ');
      if (describedBy) {
        field.setAttribute('aria-describedby', describedBy);
      } else {
        field.removeAttribute('aria-describedby');
      }
    }
  }

  private fields(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  }

  /** The messages shown with the field: inside its wrapper, or right after it (label + error pattern). */
  private errorsOf(field: HTMLElement): HTMLElement[] {
    const wrapper = field.parentElement;
    if (!wrapper || wrapper === this.host.nativeElement) {
      return [];
    }

    const inside = Array.from(wrapper.querySelectorAll<HTMLElement>(ERROR_SELECTOR));
    const after: HTMLElement[] = [];
    let sibling = wrapper.nextElementSibling as HTMLElement | null;
    while (sibling && sibling.matches(ERROR_SELECTOR)) {
      after.push(sibling);
      sibling = sibling.nextElementSibling as HTMLElement | null;
    }
    return [...inside, ...after].filter((error) => (error.textContent ?? '').trim().length > 0);
  }

  private idOf(error: HTMLElement): string {
    if (!error.id || !error.id.startsWith('form-error-')) {
      error.id = `form-error-${nextErrorId++}`;
    }
    return error.id;
  }
}
