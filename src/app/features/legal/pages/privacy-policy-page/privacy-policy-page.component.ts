import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  LEGAL_OPERATOR,
  LEGAL_ROUTES,
  PRIVACY_POLICY_META,
} from '../../../../core/config/legal.config';
import {
  LegalDocumentComponent,
  LegalSectionLink,
} from '../../components/legal-document/legal-document.component';

/**
 * Public privacy policy (/privacidad), adapted for reading from the reviewed draft.
 *
 * Wording rule: describe only what the app and the business do today. Pending items (identification of the
 * responsible party, effective date, consent capture, minors' accounts, deletion and request procedures, provider
 * inventory, retention) are tracked in the knowledge base and are never shown here as placeholders or as done.
 */
@Component({
  selector: 'app-privacy-policy-page',
  imports: [LegalDocumentComponent, RouterLink],
  templateUrl: './privacy-policy-page.component.html',
})
export class PrivacyPolicyPageComponent {
  readonly operator = LEGAL_OPERATOR;
  readonly meta = PRIVACY_POLICY_META;
  readonly routes = LEGAL_ROUTES;

  readonly sections: LegalSectionLink[] = [
    { id: 'responsable', title: 'Responsable y contacto' },
    { id: 'datos', title: 'Datos que tratamos' },
    { id: 'finalidades', title: 'Para qué usamos los datos' },
    { id: 'autorizacion', title: 'Autorización' },
    { id: 'menores', title: 'Menores de edad' },
    { id: 'acceso', title: 'Acceso y proveedores' },
    { id: 'almacenamiento', title: 'Cookies y almacenamiento' },
    { id: 'derechos', title: 'Tus derechos' },
    { id: 'conservacion', title: 'Conservación y seguridad' },
    { id: 'cambios', title: 'Cambios de esta política' },
  ];
}
