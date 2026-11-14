import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicAvailabilitySlotResponse } from '../../../../../core/models/availability.models';
import { PublicStaffListItemResponse, PublicStaffServiceResponse } from '../../../../../core/models/content.models';
import { PublicAvailabilityApiService } from '../../../../../core/services/public-availability-api.service';
import { PublicStaffApiService } from '../../../../../core/services/public-staff-api.service';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { LoadErrorComponent } from '../../../../../shared/components/load-error/load-error.component';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-public-staff-list-page',
  imports: [ModalDialogDirective, 
    ReactiveFormsModule,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    LoadErrorComponent,
  ],
  templateUrl: './public-staff-list-page.component.html',
  styleUrl: './public-staff-list-page.component.scss',
})
export class PublicStaffListPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly publicStaffApiService = inject(PublicStaffApiService);
  private readonly publicAvailabilityApiService = inject(PublicAvailabilityApiService);

  private readonly timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  readonly searchControl = new FormControl('', { nonNullable: true });
  /** [formGroup] binds FormGroupDirective, which emits ngSubmit and cancels the native submit (BUG-046). */
  readonly searchForm = new FormGroup({ search: this.searchControl });
  readonly isLoading = signal(true);
  /** SONDA BUG-057: placeholders shown while the list loads. */
  readonly skeletonCards = [1, 2, 3, 4];
  readonly errorMessage = signal<string | null>(null);
  /** SONDA BUG-045: the list could not be loaded (it was shown as «Sin coincidencias»). */
  readonly loadError = signal<unknown>(null);
  readonly staffMembers = signal<PublicStaffListItemResponse[]>([]);

  // Availability modal
  readonly activeStaff = signal<PublicStaffListItemResponse | null>(null);
  readonly selectedDate = signal(todayIso());
  readonly slots = signal<PublicAvailabilitySlotResponse[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly slotsLoaded = signal(false);
  /** General service the free times are computed for (ADR-0016 B3). */
  readonly selectedServiceId = signal<string | null>(null);

  readonly searchButtonLabel = computed(() => (this.isLoading() ? 'Buscando...' : 'Buscar'));

  async ngOnInit(): Promise<void> {
    await this.loadStaff();
  }

  @SingleFlight()
  async submitSearch(): Promise<void> {
    await this.loadStaff(this.searchControl.value);
  }

  async clearSearch(): Promise<void> {
    this.searchControl.setValue('');
    await this.loadStaff();
  }

  staffRoleSummary(member: PublicStaffListItemResponse): string {
    return member.services
      .slice(0, 2)
      .map((s) => s.name)
      .join(' · ');
  }

  visibleServices(staffMember: PublicStaffListItemResponse) {
    return staffMember.services.slice(0, 3);
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
    this.selectedServiceId.set(staffMember.services[0]?.generalServiceId ?? null);
    this.slots.set([]);
    this.slotsLoaded.set(false);
    this.slotsError.set(null);
    void this.loadSlots(staffMember.staffProfileId);
  }

  onServiceChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const staffProfileId = this.activeStaff()?.staffProfileId;
    if (!value || !staffProfileId) return;
    this.selectedServiceId.set(value);
    this.slotsLoaded.set(false);
    void this.loadSlots(staffProfileId);
  }

  formatServiceOption(service: PublicStaffServiceResponse): string {
    return `${service.name} · ${service.durationMinutes} min`;
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
    const generalServiceId = this.selectedServiceId();
    if (!generalServiceId) return;
    void this.router.navigate(['/booking/confirm'], {
      queryParams: { staffProfileId, startsAt: slot.startAtUtc, generalServiceId },
    });
  }

  private async loadSlots(staffProfileId: string): Promise<void> {
    const date = this.selectedDate();
    const generalServiceId = this.selectedServiceId();
    if (!generalServiceId) {
      this.slots.set([]);
      return;
    }

    this.slotsLoading.set(true);
    this.slotsError.set(null);
    try {
      const response = await firstValueFrom(
        this.publicAvailabilityApiService.getSlots(staffProfileId, date, date, { generalServiceId }),
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

  retryStaff(): Promise<void> {
    return this.loadStaff(this.searchControl.value);
  }

  private async loadStaff(search?: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);

    try {
      this.staffMembers.set(await firstValueFrom(this.publicStaffApiService.list(search)));
    } catch (error) {
      this.loadError.set(error ?? new Error('load failed'));
      this.staffMembers.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
