import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { CashClosingPanelComponent } from '../../components/cash-closing-panel/cash-closing-panel.component';
import { bogotaMonthStart } from '../admin-reports-page/admin-reports-page.component';

/**
 * ADR-0021 L2: the cash closing on its own page, for whoever holds reports.cash.view (Admin by default, assignable to
 * any role). The rest of «Reportes» stays with the administration.
 */
@Component({
  selector: 'app-admin-cash-closing-page',
  imports: [FormsModule, CashClosingPanelComponent],
  templateUrl: './admin-cash-closing-page.component.html',
  styleUrl: '../admin-reports-page/admin-reports-page.component.scss',
})
export class AdminCashClosingPageComponent {
  readonly from = signal(bogotaToday());
  readonly to = signal(bogotaToday());

  setToday(): void {
    const today = bogotaToday();
    this.from.set(today);
    this.to.set(today);
  }

  setThisMonth(): void {
    this.from.set(bogotaMonthStart());
    this.to.set(bogotaToday());
  }
}
