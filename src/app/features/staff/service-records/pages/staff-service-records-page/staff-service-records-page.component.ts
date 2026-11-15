import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import {
  SERVICE_RECORD_OPERATION_LABELS,
  SERVICE_RECORD_STATUS_LABELS,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

/**
 * ADR-0020 (Q6): registering services performed was replaced by the bills; the API answers 410 to a new registration.
 * This page keeps the professional's own records in read only (pending first) while the administration reviews the
 * ones still pending, and points to «Cuentas».
 */
@Component({
  selector: 'app-staff-service-records-page',
  imports: [DatePipe, LowerCasePipe, RouterLink, ApiFeedbackComponent, PaginatorComponent],
  templateUrl: './staff-service-records-page.component.html',
  styleUrl: './staff-service-records-page.component.scss',
})
export class StaffServiceRecordsPageComponent implements OnInit {
  private readonly serviceRecordsApi = inject(ServiceRecordsApiService);

  readonly statusLabels = SERVICE_RECORD_STATUS_LABELS;
  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;
  readonly errorMessage = signal<string | null>(null);
  readonly records = signal<ServiceRecordView[]>([]);
  readonly recordsTotal = signal(0);
  readonly recordsPage = signal(1);
  readonly recordsPageSize = DEFAULT_PAGE_SIZE;
  readonly recordsLoading = signal(true);

  async ngOnInit(): Promise<void> {
    await this.loadRecords();
  }

  async onRecordsPageChange(page: number): Promise<void> {
    this.recordsPage.set(page);
    await this.loadRecords();
  }

  private async loadRecords(): Promise<void> {
    this.recordsLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(this.serviceRecordsApi.mine({ page: this.recordsPage(), pageSize: this.recordsPageSize }));
      this.records.set(result.items);
      this.recordsTotal.set(result.totalCount);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.recordsLoading.set(false);
    }
  }
}
