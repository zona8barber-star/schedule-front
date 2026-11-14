import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { formatDate } from '@angular/common';

import { BOGOTA_UTC_OFFSET } from '../../core/utils/bogota-date.utils';

/**
 * Like DatePipe, but an instant (submittedAt, performedAt…) is shown in Bogotá time whatever the device's timezone
 * (pending from SONDA lote B). Use it only for instants: date-only fields (…On, approveBy) keep DatePipe, which would
 * otherwise move them a day back.
 */
@Pipe({ name: 'bogotaDate' })
export class BogotaDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | Date | null | undefined, format = 'mediumDate'): string | null {
    if (value === null || value === undefined || value === '') return null;
    return formatDate(value, format, this.locale, BOGOTA_UTC_OFFSET);
  }
}
