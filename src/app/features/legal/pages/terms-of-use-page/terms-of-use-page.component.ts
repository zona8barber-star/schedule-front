import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  LEGAL_OPERATOR,
  LEGAL_ROUTES,
  TERMS_OF_USE_META,
} from '../../../../core/config/legal.config';
import {
  LegalDocumentComponent,
  LegalSectionLink,
} from '../../components/legal-document/legal-document.component';

/**
 * Public terms of use (/terminos), adapted for reading from the reviewed draft.
 *
 * Same wording rule as the privacy policy: only what exists today. Pending business rules (rescheduling,
 * cancellation, late arrival), the minors' account flow and the effective date stay out of the text.
 */
@Component({
  selector: 'app-terms-of-use-page',
  imports: [LegalDocumentComponent, RouterLink],
  templateUrl: './terms-of-use-page.component.html',
})
export class TermsOfUsePageComponent {
  readonly operator = LEGAL_OPERATOR;
  readonly meta = TERMS_OF_USE_META;
  readonly routes = LEGAL_ROUTES;

  readonly sections: LegalSectionLink[] = [
    { id: 'operador', title: 'Quién presta el servicio' },
    { id: 'cuenta', title: 'Tu cuenta y uso permitido' },
    { id: 'citas', title: 'Citas y servicios' },
    { id: 'membresias', title: 'Membresías y puntos' },
    { id: 'productos', title: 'Catálogo de productos' },
    { id: 'resenas', title: 'Reseñas, imágenes y notificaciones' },
    { id: 'responsabilidad', title: 'Disponibilidad y responsabilidad' },
    { id: 'atencion', title: 'Atención y cambios' },
  ];
}
