/**
 * Data shown on the public legal pages (/privacidad, /terminos) and their footer links.
 *
 * Only data confirmed by the business goes here. Missing items (legal full name and identification of the
 * responsible party, effective date, rights-request procedure, retention table…) are tracked in the knowledge base
 * and must NOT be filled with placeholders: the pages render whatever is set here, as is.
 */
export interface LegalOperatorConfig {
  tradeName: string;
  /** Name given by the business for the responsible party, kept exactly as provided. */
  responsibleName: string;
  city: string;
  address: string;
  email: string;
  whatsapp: string;
}

export const LEGAL_OPERATOR: LegalOperatorConfig = {
  tradeName: 'Zona 8',
  responsibleName: 'Daivid',
  city: 'Medellín, Colombia',
  address: 'Carrera 86 #44-81, La América, Medellín',
  email: 'zona8barber@gmail.com',
  whatsapp: '+57 314 600 0074',
};

export interface LegalDocumentMeta {
  version: string;
  /** ISO date (yyyy-mm-dd) of the last text revision. */
  updatedOn: string;
  /**
   * ISO date from which the document is in force. `null` while the text has not been adopted by the business:
   * the page then says the document is under review instead of presenting it as current.
   */
  effectiveOn: string | null;
}

export const PRIVACY_POLICY_META: LegalDocumentMeta = {
  version: '1.0',
  updatedOn: '2026-11-08',
  effectiveOn: null,
};

export const TERMS_OF_USE_META: LegalDocumentMeta = {
  version: '1.0',
  updatedOn: '2026-11-08',
  effectiveOn: null,
};

export const LEGAL_ROUTES = {
  privacy: '/privacidad',
  terms: '/terminos',
} as const;
