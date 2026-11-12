import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  DEVELOPER_CREDIT_CONFIG,
  buildDeveloperCredit,
} from '../../config/developer-credit.config';
import { LEGAL_OPERATOR, LEGAL_ROUTES } from '../../config/legal.config';

/**
 * Single site footer, rendered once by the app shell under every page (public, account and back-office), so pages
 * must not add their own. It keeps clear of the phone shortcut bar and of the floating WhatsApp button.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
})
export class SiteFooterComponent {
  readonly tradeName = LEGAL_OPERATOR.tradeName;
  readonly routes = LEGAL_ROUTES;
  readonly currentYear = new Date().getFullYear();
  readonly developerCredit = buildDeveloperCredit(inject(DEVELOPER_CREDIT_CONFIG));
}
