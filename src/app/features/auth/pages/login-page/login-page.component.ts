import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly authService = inject(AuthService);

  readonly minimumPasswordLength = 8;
  readonly maximumPasswordLength = 128;

  readonly isRegisterTab = this.route.snapshot.routeConfig?.path === 'register';
  readonly tabQueryParams = this.buildTabQueryParams();

  readonly loginSubmitted = signal(false);
  readonly registerSubmitted = signal(false);

  readonly isLoginPasswordVisible = signal(false);
  readonly isRegisterPasswordVisible = signal(false);
  readonly isConfirmPasswordVisible = signal(false);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly registerForm = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.maxLength(40)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(this.minimumPasswordLength),
          Validators.maxLength(this.maximumPasswordLength),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [matchingPasswordsValidator()],
    },
  );

  constructor() {
    this.authService.clearError();
  }

  async submitLogin(): Promise<void> {
    this.loginSubmitted.set(true);
    this.authService.clearError();

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    try {
      await this.authService.login(this.loginForm.getRawValue());
      await this.router.navigateByUrl(
        this.authService.resolvePostAuthUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
    } catch {
      // El servicio de autenticacion ya expone el mensaje para el componente de feedback.
    }
  }

  async submitRegister(): Promise<void> {
    this.registerSubmitted.set(true);
    this.authService.clearError();

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValue = this.registerForm.getRawValue();

    try {
      await this.authService.register({
        fullName: formValue.fullName,
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

  showLoginError(controlName: 'email' | 'password', errorName: string): boolean {
    const control = this.loginForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.loginSubmitted());
  }

  showRegisterError(
    controlName: 'fullName' | 'email' | 'phoneNumber' | 'password' | 'confirmPassword',
    errorName: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.registerSubmitted());
  }

  showRegisterPasswordMismatchError(): boolean {
    return (
      this.registerForm.hasError('passwordMismatch') &&
      (this.registerForm.controls.confirmPassword.touched || this.registerSubmitted())
    );
  }

  isMinPasswordLengthMet(): boolean {
    return this.registerForm.controls.password.value.length >= this.minimumPasswordLength;
  }

  isMaxPasswordLengthMet(): boolean {
    return this.registerForm.controls.password.value.length <= this.maximumPasswordLength;
  }

  toggleLoginPasswordVisibility(): void {
    this.isLoginPasswordVisible.update((current) => !current);
  }

  toggleRegisterPasswordVisibility(): void {
    this.isRegisterPasswordVisible.update((current) => !current);
  }

  toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordVisible.update((current) => !current);
  }

  private buildTabQueryParams(): { returnUrl: string } | null {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl ? { returnUrl } : null;
  }
}

function matchingPasswordsValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';

    if (!confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}
