import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PermissionView, RoleView } from '../../../../../core/models/role.models';
import { AdminRolesApiService } from '../../../../../core/services/admin-roles-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminRoleFormModalComponent } from '../../components/admin-role-form-modal/admin-role-form-modal.component';

@Component({
  selector: 'app-admin-roles-list-page',
  imports: [ApiFeedbackComponent, AdminRoleFormModalComponent],
  templateUrl: './admin-roles-list-page.component.html',
  styleUrl: './admin-roles-list-page.component.scss',
})
export class AdminRolesListPageComponent implements OnInit {
  private readonly adminRolesApiService = inject(AdminRolesApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly roles = signal<RoleView[]>([]);
  readonly permissions = signal<PermissionView[]>([]);
  readonly isModalOpen = signal(false);
  readonly editingRole = signal<RoleView | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  openCreate(): void {
    this.editingRole.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(role: RoleView): void {
    this.editingRole.set(role);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingRole.set(null);
  }

  onSaved(result: RoleView): void {
    const exists = this.roles().some((r) => r.id === result.id);
    this.roles.update((list) =>
      exists ? list.map((r) => (r.id === result.id ? result : r)) : [...list, result],
    );
    this.closeModal();
  }

  formatPermissions(role: RoleView): string {
    return role.permissions.map((p) => p.description).join(', ') || '—';
  }

  async deleteRole(role: RoleView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar rol?',
      message: `Se eliminará el rol "${role.name}". Los usuarios que lo tengan asignado lo perderán.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(role.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.adminRolesApiService.remove(role.id));
      this.roles.update((list) => list.filter((r) => r.id !== role.id));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [roles, permissions] = await Promise.all([
        firstValueFrom(this.adminRolesApiService.list()),
        firstValueFrom(this.adminRolesApiService.listPermissions()),
      ]);
      this.roles.set(roles);
      this.permissions.set(permissions);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
