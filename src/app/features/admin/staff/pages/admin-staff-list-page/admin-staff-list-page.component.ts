import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { ROLE_NAMES } from '../../../../../core/models/auth.models';
import { StaffListItem, StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { AdminStaffFormModalComponent } from '../../components/admin-staff-form-modal/admin-staff-form-modal.component';

@Component({
  selector: 'app-admin-staff-list-page',
  imports: [ApiFeedbackComponent, AdminStaffFormModalComponent, RouterLink],
  templateUrl: './admin-staff-list-page.component.html',
  styleUrl: './admin-staff-list-page.component.scss',
})
export class AdminStaffListPageComponent implements OnInit {
  private readonly adminStaffApiService = inject(AdminStaffApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly staffMembers = signal<StaffListItem[]>([]);

  readonly isModalOpen = signal(false);
  readonly editingStaffId = signal<string | null>(null);
  readonly togglingStaffId = signal<string | null>(null);

  readonly isActivating = signal(false);
  readonly canActivateProfessional = computed(
    () => this.authService.isAuthenticated() && !this.authService.hasRole(ROLE_NAMES.staff),
  );

  ngOnInit(): void {
    void this.loadStaff();
  }

  openCreate(): void {
    this.editingStaffId.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(staffId: string): void {
    this.editingStaffId.set(staffId);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingStaffId.set(null);
  }

  onSaved(result: StaffResponse): void {
    const existing = this.staffMembers().find((m) => m.staffProfileId === result.staffProfileId);

    if (existing) {
      this.staffMembers.update((list) =>
        list.map((m) => (m.staffProfileId === result.staffProfileId ? result : m)),
      );
    } else {
      this.staffMembers.update((list) => [...list, result]);
    }

    this.closeModal();
  }

  /**
   * SONDA BUG-071: the API has no way to delete a professional (DELETE /admin/staff/{id} does not exist) and no design
   * decision defines it, so the action deactivates or reactivates them through the existing status endpoint. A
   * deactivated professional stops being bookable and keeps their history; nothing is deleted.
   */
  async toggleStaffStatus(member: StaffListItem): Promise<void> {
    const deactivating = member.isActive;
    const confirmed = await this.confirmModal.confirm({
      title: deactivating ? '¿Desactivar profesional?' : '¿Activar profesional?',
      message: deactivating
        ? `"${member.displayName}" dejará de aparecer para reservar y no podrá iniciar sesión. Su historial se conserva y podrás activarlo de nuevo.`
        : `"${member.displayName}" volverá a aparecer para reservar y podrá iniciar sesión.`,
      confirmLabel: deactivating ? 'Sí, desactivar' : 'Sí, activar',
      danger: deactivating,
    });
    if (!confirmed) return;

    this.togglingStaffId.set(member.staffProfileId);
    this.errorMessage.set(null);

    try {
      const updated = await firstValueFrom(
        this.adminStaffApiService.updateStatus(member.staffProfileId, { isActive: !deactivating }),
      );
      this.staffMembers.update((list) =>
        list.map((m) => (m.staffProfileId === updated.staffProfileId ? { ...m, ...updated } : m)),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.togglingStaffId.set(null);
    }
  }

  async activateProfessional(): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Activar mi perfil profesional',
      message:
        'Se creará tu perfil de profesional y aparecerás como reservable. Podrás configurar tu disponibilidad a continuación.',
    });
    if (!confirmed) return;

    this.isActivating.set(true);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(
        this.adminStaffApiService.activateOwnProfessionalProfile({
          displayName: this.authService.currentUser()?.fullName ?? '',
          defaultAppointmentDurationMinutes: null,
        }),
      );
      const refreshedToken = await this.authService.refreshAccessToken();
      if (!refreshedToken) {
        this.errorMessage.set(
          'Tu perfil profesional fue activado, pero tu sesión expiró. Vuelve a iniciar sesión.',
        );
        return;
      }
      await this.router.navigateByUrl('/staff/availability');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isActivating.set(false);
    }
  }

  private async loadStaff(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.staffMembers.set(await firstValueFrom(this.adminStaffApiService.list()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
