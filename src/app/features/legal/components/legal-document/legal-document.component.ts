import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, ViewEncapsulation, afterNextRender, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalDocumentMeta } from '../../../../core/config/legal.config';

export interface LegalSectionLink {
  id: string;
  title: string;
}

export interface LegalRelatedLink {
  label: string;
  route: string;
}

/**
 * Shared frame of the public legal pages: heading, version, review notice, table of contents and the projected text.
 *
 * Encapsulation is off on purpose: the text is projected from each page, so its `legal__*` classes must reach
 * content owned by another component. Every selector here is prefixed with `legal`, so nothing leaks elsewhere.
 */
@Component({
  selector: 'app-legal-document',
  imports: [DatePipe, RouterLink],
  templateUrl: './legal-document.component.html',
  styleUrl: './legal-document.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class LegalDocumentComponent {
  readonly title = input.required<string>();
  readonly lead = input.required<string>();
  readonly meta = input.required<LegalDocumentMeta>();
  readonly sections = input.required<LegalSectionLink[]>();
  readonly related = input.required<LegalRelatedLink>();

  private readonly document = inject(DOCUMENT);

  constructor() {
    // The router keeps the previous scroll offset; footer links are clicked at the very bottom of a page, so the
    // document would otherwise open scrolled to its end.
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (view && !this.document.location.hash && view.scrollY > 0) {
        view.scrollTo({ top: 0 });
      }
    });
  }

  sectionHref(id: string): string {
    return `${this.document.location.pathname}#${id}`;
  }

  /** Same-page jump that keeps the router out of it and moves the keyboard focus to the section heading. */
  goToSection(event: Event, id: string): void {
    const section = this.document.getElementById(id);
    if (!section) {
      return;
    }

    event.preventDefault();
    const reduceMotion =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
}
