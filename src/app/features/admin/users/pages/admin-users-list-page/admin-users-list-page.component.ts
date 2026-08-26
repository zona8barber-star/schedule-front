import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AdminUserItem } from '../../../../../core/models/admin-user.models';
import { RoleView } from '../../../../../core/models/role.models';
import { AdminRolesApiService } from '../../../../../core/services/admin-roles-api.service';
import { AdminUsersApiService } from '../../../../../core/services/admin-users-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-admin-users-list-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-users-list-page.component.html',
  styleUrl: './admin-users-list-page.component.scss',
})
export class AdminUsersListPageComponent implements OnInit {
  private readonly api = inject(AdminUsersApiService);
  private readonly rolesApi = inject(AdminRolesApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly fb = inject(FormBuilder);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly users = signal<AdminUserItem[]>([]);
  readonly customRoles = signal<RoleView[]>([]);

  readonly viewingUser = signal<AdminUserItem | null>(null);
  readonly editingUser = signal<AdminUserItem | null>(null);
  readonly selectedCustomRoleIds = signal<Set<string>>(new Set());
  readonly disablingUserId = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly isSaving = signal(false);

  readonly editForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.maxLength(40)]],
  });

  ngOnInit(): void {
    void this.loadUsers();
  }

  openView(user: AdminUserItem): void {
    this.viewingUser.set(user);
  }

  closeView(): void {
    this.viewingUser.set(null);
  }

  openEdit(user: AdminUserItem): void {
    this.editForm.reset({
      fullName: user.fullName,
      phoneNumber: user.phoneNumber ?? '',
    });
    this.selectedCustomRoleIds.set(new Set(user.customRoleIds));
    this.saveError.set(null);
    this.editingUser.set(user);
  }

  closeEdit(): void {
    this.editingUser.set(null);
    this.saveError.set(null);
  }

  isCustomRoleSelected(roleId: string): boolean {
    return this.selectedCustomRoleIds().has(roleId);
  }

  toggleCustomRole(roleId: string): void {
    this.selectedCustomRoleIds.update((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async saveEdit(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const user = this.editingUser();
    if (!user) return;

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      // Only PUT profile fields when the admin actually touched them — the backend's
      // update endpoint unconditionally overwrites DateOfBirth to null, so a role-only
      // edit must never fire this call.
      if (this.editForm.dirty) {
        const updatedProfile = await firstValueFrom(
          this.api.update(user.userId, {
            fullName: this.editForm.value.fullName!.trim(),
            phoneNumber: this.editForm.value.phoneNumber?.trim() || null,
          }),
        );
        this.users.update((list) =>
          list.map((u) => (u.userId === updatedProfile.userId ? updatedProfile : u)),
        );
      }

      const updatedWithRoles = await firstValueFrom(
        this.api.updateCustomRoles(user.userId, {
          roleIds: Array.from(this.selectedCustomRoleIds()),
        }),
      );
      this.users.update((list) =>
        list.map((u) => (u.userId === updatedWithRoles.userId ? updatedWithRoles : u)),
      );
      this.closeEdit();
    } catch (err) {
      this.saveError.set(getApiErrorMessage(err));
    } finally {
      this.isSaving.set(false);
    }
  }

  async disableUser(user: AdminUserItem): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Deshabilitar usuario?',
      message: `¿Está seguro que quiere deshabilitar a "${user.fullName}"? El usuario dejará de aparecer en el sistema.`,
    });
    if (!confirmed) return;

    this.disablingUserId.set(user.userId);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.api.deactivate(user.userId));
      this.users.update((list) => list.filter((u) => u.userId !== user.userId));
    } catch (err) {
      this.errorMessage.set(getApiErrorMessage(err));
    } finally {
      this.disablingUserId.set(null);
    }
  }

  showFieldError(field: string, error: string): boolean {
    const ctrl = this.editForm.get(field);
    return !!(ctrl?.touched && ctrl.hasError(error));
  }

  formatRoles(roles: string[]): string {
    return roles.join(', ') || '—';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // The two fetches must fail independently: a broken /admin/roles catalog is only an
    // auxiliary input to the edit checklist and must never blank the users list itself.
    const [usersResult, rolesResult] = await Promise.allSettled([
      firstValueFrom(this.api.list()),
      firstValueFrom(this.rolesApi.list()),
    ]);

    if (usersResult.status === 'fulfilled') {
      this.users.set(usersResult.value);
    } else {
      this.errorMessage.set(getApiErrorMessage(usersResult.reason));
    }

    this.customRoles.set(
      rolesResult.status === 'fulfilled'
        ? rolesResult.value.filter((role) => !role.isSystemRole)
        : [],
    );

    this.isLoading.set(false);
  }
}
