import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

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
  imports: [ApiFeedbackComponent, AdminStaffFormModalComponent],
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
  readonly deletingStaffId = signal<string | null>(null);

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

  async deleteStaff(member: StaffListItem): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar profesional?',
      message: `Se eliminará a "${member.displayName}" y no se podrá deshacer.`,
    });
    if (!confirmed) return;

    this.deletingStaffId.set(member.staffProfileId);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.adminStaffApiService.remove(member.staffProfileId));
      this.staffMembers.update((list) =>
        list.filter((m) => m.staffProfileId !== member.staffProfileId),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.deletingStaffId.set(null);
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
      await this.authService.refreshAccessToken();
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
