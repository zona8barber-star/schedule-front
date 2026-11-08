import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { GeneralServiceView, ServiceCategoryView } from '../../../../../core/models/service-catalog.models';
import {
  STAFF_DURATION_RANGE,
  StaffOfferingUpsertItem,
  StaffOfferingView,
  StaffOfferingsView,
} from '../../../../../core/models/staff.models';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/** One active general service the professional may offer. */
export interface OfferingRow {
  generalServiceId: string;
  name: string;
  checked: boolean;
  /** Raw input value; validated on save. */
  durationMinutes: number | null;
}

export interface OfferingGroup {
  categoryId: string;
  categoryName: string;
  rows: OfferingRow[];
}

/**
 * "Servicios que ofrece" (ADR-0016 B2): which general services the professional offers and how long each takes.
 * Saving replaces the whole list; offerings of inactive general services are kept as they are.
 */
@Component({
  selector: 'app-admin-staff-offerings-section',
  imports: [ApiFeedbackComponent],
  templateUrl: './admin-staff-offerings-section.component.html',
  styleUrl: './admin-staff-offerings-section.component.scss',
})
export class AdminStaffOfferingsSectionComponent implements OnInit {
  private readonly staffApi = inject(AdminStaffApiService);
  private readonly catalogApi = inject(AdminServiceCatalogApiService);

  readonly staffId = input.required<string>();

  readonly durationRange = STAFF_DURATION_RANGE;
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly defaultDuration = signal<number>(STAFF_DURATION_RANGE.suggested);

  readonly groups = signal<OfferingGroup[]>([]);
  /** Offerings whose general service (or its category) is inactive: shown read-only and kept when saving. */
  readonly inactiveOfferings = signal<StaffOfferingView[]>([]);

  readonly checkedCount = computed(
    () => this.groups().reduce((sum, group) => sum + group.rows.filter((row) => row.checked).length, 0),
  );

  private categories: ServiceCategoryView[] = [];
  private generalServices: GeneralServiceView[] = [];

  ngOnInit(): void {
    void this.load();
  }

  isDurationValid(row: OfferingRow): boolean {
    const value = row.durationMinutes;
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= STAFF_DURATION_RANGE.min &&
      value <= STAFF_DURATION_RANGE.max
    );
  }

  showDurationError(row: OfferingRow): boolean {
    return row.checked && this.submitted() && !this.isDurationValid(row);
  }

  toggle(generalServiceId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateRow(generalServiceId, (row) => ({ ...row, checked }));
  }

  setDuration(generalServiceId: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.updateRow(generalServiceId, (row) => ({ ...row, durationMinutes: Number.isNaN(value) ? null : value }));
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const checked = this.groups().flatMap((group) => group.rows.filter((row) => row.checked));
    if (checked.some((row) => !this.isDurationValid(row))) {
      this.errorMessage.set(
        `Revisa las duraciones: deben ser minutos enteros entre ${STAFF_DURATION_RANGE.min} y ${STAFF_DURATION_RANGE.max}.`,
      );
      return;
    }

    const offerings: StaffOfferingUpsertItem[] = [
      ...checked.map((row) => ({
        generalServiceId: row.generalServiceId,
        durationMinutes: row.durationMinutes as number,
        isActive: true,
      })),
      // Not editable here, but a full replacement would otherwise delete them silently.
      ...this.inactiveOfferings().map((offering) => ({
        generalServiceId: offering.generalServiceId,
        durationMinutes: offering.durationMinutes,
        isActive: offering.isActive,
      })),
    ];

    this.isSaving.set(true);
    try {
      const view = await firstValueFrom(this.staffApi.updateOfferings(this.staffId(), { offerings }));
      this.apply(view);
      this.submitted.set(false);
      this.successMessage.set('Servicios del profesional guardados.');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error, 'No pudimos guardar los servicios del profesional.'));
    } finally {
      this.isSaving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [view, categories, generalServices] = await Promise.all([
        firstValueFrom(this.staffApi.getOfferings(this.staffId())),
        firstValueFrom(this.catalogApi.listCategories()),
        firstValueFrom(this.catalogApi.listGeneralServices()),
      ]);
      this.categories = categories;
      this.generalServices = generalServices;
      this.apply(view);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error, 'No pudimos cargar los servicios del profesional.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Builds the rows from the offerings view and the active catalog. */
  private apply(view: StaffOfferingsView): void {
    this.defaultDuration.set(view.defaultAppointmentDurationMinutes);
    const categoryById = new Map(this.categories.map((category) => [category.id, category]));
    const offeringById = new Map(view.offerings.map((offering) => [offering.generalServiceId, offering]));

    const active = this.generalServices
      .filter((service) => service.isActive && service.categoryIsActive && categoryById.get(service.categoryId)?.isActive !== false)
      .sort((a, b) => {
        const byCategory =
          (categoryById.get(a.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (categoryById.get(b.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER);
        if (byCategory !== 0) return byCategory;
        const byCategoryName = a.categoryName.localeCompare(b.categoryName, 'es');
        if (byCategoryName !== 0) return byCategoryName;
        return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es');
      });

    const groups: OfferingGroup[] = [];
    for (const service of active) {
      let group = groups.find((item) => item.categoryId === service.categoryId);
      if (!group) {
        group = {
          categoryId: service.categoryId,
          categoryName: categoryById.get(service.categoryId)?.name ?? service.categoryName,
          rows: [],
        };
        groups.push(group);
      }

      const offering = offeringById.get(service.id);
      group.rows.push({
        generalServiceId: service.id,
        name: service.name,
        checked: !!offering?.isActive,
        durationMinutes: offering?.durationMinutes ?? view.defaultAppointmentDurationMinutes,
      });
    }

    const activeIds = new Set(active.map((service) => service.id));
    this.groups.set(groups);
    this.inactiveOfferings.set(view.offerings.filter((offering) => !activeIds.has(offering.generalServiceId)));
  }

  private updateRow(generalServiceId: string, change: (row: OfferingRow) => OfferingRow): void {
    this.groups.update((groups) =>
      groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => (row.generalServiceId === generalServiceId ? change(row) : row)),
      })),
    );
  }
}
