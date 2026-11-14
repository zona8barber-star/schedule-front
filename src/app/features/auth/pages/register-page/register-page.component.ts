import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { AuthService } from '../../../../core/services/auth.service';

import { FieldErrorComponent } from '../../../../shared/components/field-error/field-error.component';
import { trimmedMinLength, trimmedRequired } from '../../../../core/utils/form-validators';

import { FormA11yDirective } from '../../../../shared/directives/form-a11y.directive';

import { SingleFlight } from '../../../../core/utils/single-flight';

@Component({
  selector: 'app-register-page',
  imports: [FormA11yDirective, FieldErrorComponent, ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly authService = inject(AuthService);
  readonly submitted = signal(false);

  readonly registerForm = this.formBuilder.nonNullable.group({
    fullName: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.maxLength(40)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  constructor() {
    this.authService.clearError();
  }

  @SingleFlight()
  async submit(): Promise<void> {
    this.submitted.set(true);
    this.authService.clearError();

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValue = this.registerForm.getRawValue();

    try {
      await this.authService.register({
        fullName: (formValue.fullName ?? '').trim(),
        email: formValue.email,
        password: formValue.password,
        phoneNumber: formValue.phoneNumber.trim() ? formValue.phoneNumber.trim() : null,
      });

      await this.router.navigateByUrl(
        this.authService.resolvePostAuthUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
    } catch {
      // El servicio de autenticacion ya expone el mensaje para el componente de feedback.
    }
  }

  showError(
    controlName: 'fullName' | 'email' | 'phoneNumber' | 'password',
    errorName: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }
}
