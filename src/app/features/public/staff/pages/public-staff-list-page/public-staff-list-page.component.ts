import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import { PublicStaffListItemResponse } from '../../../../../core/models/content.models';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicContentApiService } from '../../../../../core/services/public-content-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-public-staff-list-page',
  imports: [ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './public-staff-list-page.component.html',
  styleUrl: './public-staff-list-page.component.scss',
})
export class PublicStaffListPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicContentApiService = inject(PublicContentApiService);
  private readonly publicAvailabilityApiService = inject(PublicAvailabilityApiService);

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly staffMembers = signal<PublicStaffListItemResponse[]>([]);
  readonly contactPhone = signal<string | null>(null);

  // Availability modal
  readonly activeStaff = signal<PublicStaffListItemResponse | null>(null);
  readonly selectedDate = signal(todayIso());
  readonly slots = signal<PublicAvailabilitySlotResponse[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly slotsLoaded = signal(false);

  readonly searchButtonLabel = computed(() => (this.isLoading() ? 'Buscando...' : 'Buscar'));

  readonly whatsappUrl = computed<string | null>(() => {
    const phone = this.contactPhone();
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadStaff(),
      firstValueFrom(this.publicContentApiService.getLanding())
        .then((landing) => this.contactPhone.set(landing.contactPhone))
        .catch(() => {}),
    ]);
  }

  async submitSearch(): Promise<void> {
    await this.loadStaff(this.searchControl.value);
  }

  async clearSearch(): Promise<void> {
    this.searchControl.setValue('');
    await this.loadStaff();
  }

  visibleServices(staffMember: PublicStaffListItemResponse) {
    return staffMember.services.filter((service) => service.isActive).slice(0, 3);
  }

  formatRating(value: number): string {
    return value.toFixed(1);
  }

  todayDate(): string {
    return todayIso();
  }

  formatSlotTime(utc: string): string {
    return this.timeFormatter.format(new Date(utc));
  }

  openAvailabilityModal(staffMember: PublicStaffListItemResponse): void {
    this.activeStaff.set(staffMember);
    this.selectedDate.set(todayIso());
    this.slots.set([]);
    this.slotsLoaded.set(false);
    this.slotsError.set(null);
    void this.loadSlots(staffMember.staffProfileId);
  }

  closeAvailabilityModal(): void {
    this.activeStaff.set(null);
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!staffProfileId) return;
    this.selectedDate.set(value);
    this.slotsLoaded.set(false);
    void this.loadSlots(staffProfileId);
  }

  selectSlot(slot: PublicAvailabilitySlotResponse): void {
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!staffProfileId) return;
    void this.router.navigate(['/booking/confirm'], {
      queryParams: { staffProfileId, startsAt: slot.startAtUtc },
    });
  }

  private async loadSlots(staffProfileId: string): Promise<void> {
    const date = this.selectedDate();
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    try {
      const response = await firstValueFrom(
        this.publicAvailabilityApiService.getSlots(staffProfileId, date, date),
      );
      this.slots.set(response.slots);
      this.slotsLoaded.set(true);
    } catch {
      this.slotsError.set('No pudimos cargar los horarios. Intenta de nuevo.');
      this.slots.set([]);
    } finally {
      this.slotsLoading.set(false);
    }
  }

  private async loadStaff(search?: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.staffMembers.set(await firstValueFrom(this.publicStaffApiService.list(search)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.staffMembers.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
