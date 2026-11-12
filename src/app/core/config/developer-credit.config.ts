import { InjectionToken } from '@angular/core';

import { LEGAL_OPERATOR } from './legal.config';

/** Who built the app, shown as a discreet credit in the site footer. */
export interface DeveloperCreditConfig {
  name: string;
  email: string;
}

/**
 * Confirmed by the developer (2026-11-09). If either value is ever blank or a placeholder, the footer shows no
 * credit at all (never a placeholder).
 */
export const DEVELOPER_CREDIT: DeveloperCreditConfig = {
  name: 'diazbetancur',
  email: 'diazbetancur@gmail.com',
};

export const DEVELOPER_CONTACT_SUBJECT = 'Consulta sobre desarrollo web';

export const DEVELOPER_CREDIT_CONFIG = new InjectionToken<DeveloperCreditConfig>(
  'DEVELOPER_CREDIT_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEVELOPER_CREDIT,
  },
);

export interface DeveloperCreditLink {
  name: string;
  href: string;
}

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * Builds the credit link, or `null` when the data is missing, looks like a placeholder, is not a valid address,
 * or is the business' own e-mail (the business contact must never be presented as the developer's).
 */
export function buildDeveloperCredit(config: DeveloperCreditConfig): DeveloperCreditLink | null {
  const name = config.name.trim();
  const email = config.email.trim();

  if (!name || !email || /[[\]]/.test(name) || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  if (email.toLowerCase() === LEGAL_OPERATOR.email.toLowerCase()) {
    return null;
  }

  return {
    name,
    href: `mailto:${email}?subject=${encodeURIComponent(DEVELOPER_CONTACT_SUBJECT)}`,
  };
}
