import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../models/auth.models';
import { AuthService } from './auth.service';
import { ServiceRecordsApiService } from './service-records-api.service';

/**
 * ADR-0020 stage 6: whether records registered before the bills still wait for review. The old tray stays in the menu
 * only while there are some; the reviewed ones are reached from «Cuentas» → «Registros anteriores». Read once per user
 * with service-records.approve, and again after each review.
 */
@Injectable({
  providedIn: 'root',
})
export class ServiceRecordsPendingService {
  private readonly authService = inject(AuthService);
  private readonly api = inject(ServiceRecordsApiService);

  private readonly hasPendingState = signal(false);
  private checkedUserId: string | null = null;

  readonly hasPending = this.hasPendingState.asReadonly();

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      const canReview = this.authService.hasPermission(PERMISSION_CODES.serviceRecordsApprove);
      if (!user || !canReview) {
        this.checkedUserId = null;
        this.hasPendingState.set(false);
        return;
      }
      if (this.checkedUserId !== user.id) {
        this.checkedUserId = user.id;
        void this.refresh();
      }
    });
  }

  /** Reads the count again (after approving or rejecting a record). */
  async refresh(): Promise<void> {
    const userId = this.checkedUserId;
    if (!userId) {
      return;
    }
    try {
      const { count } = await firstValueFrom(this.api.pendingCount());
      if (this.checkedUserId === userId) {
        this.hasPendingState.set(count > 0);
      }
    } catch {
      // Without the answer the menu item stays hidden; «Registros anteriores» still opens the tray.
      if (this.checkedUserId === userId) {
        this.hasPendingState.set(false);
      }
    }
  }
}
