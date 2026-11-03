import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  SERVICE_RECORD_OPERATION_LABELS,
  ServiceRecordOptionsView,
  ServiceRecordStatus,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { AdminServiceRecordReviewModalComponent } from '../../components/admin-service-record-review-modal/admin-service-record-review-modal.component';

const TABS: { status: ServiceRecordStatus; label: string }[] = [
  { status: 'Pending', label: 'Pendientes' },
  { status: 'Approved', label: 'Confirmados' },
  { status: 'Rejected', label: 'Rechazados' },
];

@Component({
  selector: 'app-admin-service-records-page',
  imports: [DatePipe, DecimalPipe, ApiFeedbackComponent, PageStateComponent, AdminServiceRecordReviewModalComponent],
  templateUrl: './admin-service-records-page.component.html',
  styleUrl: './admin-service-records-page.component.scss',
})
export class AdminServiceRecordsPageComponent implements OnInit {
  private readonly api = inject(ServiceRecordsApiService);

  readonly tabs = TABS;
  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;

  readonly status = signal<ServiceRecordStatus>('Pending');
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly records = signal<ServiceRecordView[]>([]);
  readonly options = signal<ServiceRecordOptionsView | null>(null);
  readonly reviewing = signal<ServiceRecordView | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.options.set(await firstValueFrom(this.api.options()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
    await this.load();
  }

  async selectTab(status: ServiceRecordStatus): Promise<void> {
    this.status.set(status);
    this.successMessage.set(null);
    await this.load();
  }

  openReview(record: ServiceRecordView): void {
    this.reviewing.set(record);
  }

  closeReview(): void {
    this.reviewing.set(null);
  }

  onReviewed(result: ServiceRecordView): void {
    this.records.update((list) => list.filter((record) => record.id !== result.id));
    this.successMessage.set(
      result.status === 'Approved'
        ? `"${result.approval?.serviceName}" confirmado como ${this.operationLabels[result.approval!.operationType].toLowerCase()}.`
        : `Registro de "${result.serviceName}" rechazado.`,
    );
    this.closeReview();
  }

  async onStale(): Promise<void> {
    this.closeReview();
    await this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.records.set(await firstValueFrom(this.api.list(this.status())));
    } catch (error) {
      this.records.set([]);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
