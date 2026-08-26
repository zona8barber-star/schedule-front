import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PermissionView, RoleView } from '../../../../../core/models/role.models';
import { AdminRolesApiService } from '../../../../../core/services/admin-roles-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-admin-role-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-role-form-modal.component.html',
  styleUrl: './admin-role-form-modal.component.scss',
})
export class AdminRoleFormModalComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminRolesApiService = inject(AdminRolesApiService);

  @Input() role: RoleView | null = null;
  @Input({ required: true }) permissions: PermissionView[] = [];
  @Output() readonly saved = new EventEmitter<RoleView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedPermissionIds = signal<Set<string>>(new Set());

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
  });

  get isEditing(): boolean {
    return this.role !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['role']) {
      this.form.reset({ name: this.role?.name ?? '' });
      this.selectedPermissionIds.set(new Set(this.role?.permissions.map((p) => p.id) ?? []));
    }
  }

  isSelected(permissionId: string): boolean {
    return this.selectedPermissionIds().has(permissionId);
  }

  togglePermission(permissionId: string): void {
    this.selectedPermissionIds.update((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload = {
      name: this.form.controls.name.value.trim(),
      permissionIds: Array.from(this.selectedPermissionIds()),
    };

    try {
      const result = this.role
        ? await firstValueFrom(this.adminRolesApiService.update(this.role.id, payload))
        : await firstValueFrom(this.adminRolesApiService.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isSaving()) {
      return;
    }
    this.cancelled.emit();
  }
}
