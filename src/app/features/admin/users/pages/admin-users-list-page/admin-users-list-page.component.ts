import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AdminUserItem } from '../../../../../core/models/admin-user.models';
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
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly fb = inject(FormBuilder);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly users = signal<AdminUserItem[]>([]);

  readonly viewingUser = signal<AdminUserItem | null>(null);
  readonly editingUser = signal<AdminUserItem | null>(null);
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
    this.saveError.set(null);
    this.editingUser.set(user);
  }

  closeEdit(): void {
    this.editingUser.set(null);
    this.saveError.set(null);
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
      const updated = await firstValueFrom(
        this.api.update(user.userId, {
          fullName: this.editForm.value.fullName!.trim(),
          phoneNumber: this.editForm.value.phoneNumber?.trim() || null,
        }),
      );
      this.users.update((list) => list.map((u) => (u.userId === updated.userId ? updated : u)));
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
    try {
      this.users.set(await firstValueFrom(this.api.list()));
    } catch (err) {
      this.errorMessage.set(getApiErrorMessage(err));
    } finally {
      this.isLoading.set(false);
    }
  }
}
