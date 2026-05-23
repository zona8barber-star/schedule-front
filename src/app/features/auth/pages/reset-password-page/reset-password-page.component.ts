import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthApiService } from '../../../../core/services/auth-api.service';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authApiService = inject(AuthApiService);

  readonly minimumPasswordLength = 8;
  readonly maximumPasswordLength = 128;

  readonly token = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly isPasswordVisible = signal(false);
  readonly isConfirmVisible = signal(false);

  readonly form = this.formBuilder.nonNullable.group(
    {
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(this.minimumPasswordLength),
          Validators.maxLength(this.maximumPasswordLength),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchingPasswordsValidator()] },
  );

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');

    const token = this.token();
    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    try {
      await firstValueFrom(
        this.authApiService.resetPassword({ token, newPassword: this.form.getRawValue().newPassword }),
      );
      this.success.set(true);
    } catch (err: unknown) {
      this.error.set(extractTokenError(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  showError(controlName: 'newPassword' | 'confirmPassword', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  showMismatchError(): boolean {
    return (
      this.form.hasError('passwordMismatch') &&
      (this.form.controls.confirmPassword.touched || this.submitted())
    );
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible.update((v) => !v);
  }

  toggleConfirmVisibility(): void {
    this.isConfirmVisible.update((v) => !v);
  }
}

function matchingPasswordsValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('newPassword')?.value ?? '';
    const confirm = group.get('confirmPassword')?.value ?? '';
    if (!confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  };
}

function extractTokenError(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const apiError = (err as { error: { errors?: Record<string, string[]> } }).error;
    const tokenErrors = apiError?.errors?.['token'];
    if (tokenErrors?.length) return tokenErrors[0];
  }
  return 'Ocurrió un error. Intenta de nuevo.';
}
