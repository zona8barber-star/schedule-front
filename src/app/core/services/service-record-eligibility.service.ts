import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../models/auth.models';
import { AuthService } from './auth.service';
import { ServiceRecordsApiService } from './service-records-api.service';

/**
 * Whether the signed-in user can register services: the service-records.register permission plus an active professional
 * profile of their own, whatever their role. Read once per user; the API still checks it on every registration.
 */
@Injectable({
  providedIn: 'root',
})
export class ServiceRecordEligibilityService {
  private readonly authService = inject(AuthService);
  private readonly api = inject(ServiceRecordsApiService);

  private readonly canRegisterState = signal(false);
  private checkedUserId: string | null = null;

  readonly canRegister = this.canRegisterState.asReadonly();

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      const hasPermission = this.authService.hasPermission(PERMISSION_CODES.serviceRecordsRegister);
      if (!user || !hasPermission) {
        this.checkedUserId = null;
        this.canRegisterState.set(false);
        return;
      }
      if (this.checkedUserId !== user.id) {
        this.checkedUserId = user.id;
        void this.check(user.id);
      }
    });
  }

  private async check(userId: string): Promise<void> {
    try {
      const eligibility = await firstValueFrom(this.api.eligibility());
      if (this.checkedUserId === userId) {
        this.canRegisterState.set(eligibility.hasStaffProfile);
      }
    } catch {
      // Without the answer the link stays hidden; the page itself explains a missing profile.
      if (this.checkedUserId === userId) {
        this.canRegisterState.set(false);
      }
    }
  }
}
