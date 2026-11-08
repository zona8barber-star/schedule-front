import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { GeneralServiceView } from '../../../../../core/models/service-catalog.models';
import { CatalogStatusFilter, ServiceView } from '../../../../../core/models/service.models';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminServiceFormModalComponent } from '../../components/admin-service-form-modal/admin-service-form-modal.component';

const STATUS_OPTIONS: readonly CatalogStatusFilter[] = ['Active', 'Inactive'];

/** Rates (ADR-0016 B7): text, general service and status filters in the URL, paginated on the server. */
@Component({
  selector: 'app-admin-services-list-page',
  imports: [DecimalPipe, ApiFeedbackComponent, AdminServiceFormModalComponent, PaginatorComponent],
  templateUrl: './admin-services-list-page.component.html',
  styleUrl: './admin-services-list-page.component.scss',
})
export class AdminServicesListPageComponent implements OnInit {
  private readonly adminServicesApiService = inject(AdminServicesApiService);
  private readonly catalogApi = inject(AdminServiceCatalogApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly services = signal<ServiceView[]>([]);
  readonly totalCount = signal(0);
  readonly isModalOpen = signal(false);
  readonly editingServiceId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly query = signal('');
  /** '' shows every rate; otherwise only the rates of that general service. */
  readonly generalServiceFilter = signal('');
  readonly statusFilter = signal<CatalogStatusFilter | ''>('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly generalServices = signal<GeneralServiceView[]>([]);
  readonly hasFilters = signal(false);

  ngOnInit(): void {
    void firstValueFrom(this.catalogApi.listGeneralServices())
      .then((services) => this.generalServices.set(services))
      .catch(() => this.generalServices.set([]));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  onSearch(text: string): void {
    this.navigate({ q: text.trim(), page: 1 });
  }

  onFilterChange(event: Event): void {
    this.navigate({ generalServiceId: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onStatusChange(event: Event): void {
    this.navigate({ status: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  openCreate(): void {
    this.editingServiceId.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(serviceId: string): void {
    this.editingServiceId.set(serviceId);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingServiceId.set(null);
  }

  onSaved(): void {
    this.closeModal();
    void this.load();
  }

  async toggleActive(service: ServiceView): Promise<void> {
    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.adminServicesApiService.updateStatus(service.id, { isActive: !service.isActive }));
      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async deleteService(service: ServiceView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar tarifa?',
      message: `Se eliminará "${service.name}". No aparecerá en las listas, pero se conserva para el histórico.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.adminServicesApiService.remove(service.id));
      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private applyQuery(params: ParamMap): void {
    this.query.set(readTextParam(params, 'q'));
    this.generalServiceFilter.set(readTextParam(params, 'generalServiceId'));
    this.statusFilter.set(readOptionParam(params, 'status', STATUS_OPTIONS));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
    this.hasFilters.set(!!(this.query() || this.generalServiceFilter() || this.statusFilter()));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(patch),
      queryParamsHandling: 'merge',
    });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminServicesApiService.list({
          q: this.query() || null,
          generalServiceId: this.generalServiceFilter() || null,
          status: this.statusFilter() || null,
          page: this.page(),
          pageSize: this.pageSize(),
        }),
      );
      if (sequence === this.loadSequence) {
        this.services.set(result.items);
        this.totalCount.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
