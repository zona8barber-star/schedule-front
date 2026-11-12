import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, provideRouter } from '@angular/router';

import { routes } from '../../../app.routes';
import {
  LEGAL_OPERATOR,
  PRIVACY_POLICY_META,
  TERMS_OF_USE_META,
} from '../../../core/config/legal.config';
import { PrivacyPolicyPageComponent } from './privacy-policy-page/privacy-policy-page.component';
import { TermsOfUsePageComponent } from './terms-of-use-page/terms-of-use-page.component';

/** Markers of draft notes that must never reach the public text. */
const DRAFT_MARKERS = /\[|\]|PENDIENTE|CONFIRMAR|COMPLETAR|IMPLEMENTAR|DEFINIR|[Bb]orrador/;

describe('Public legal pages', () => {
  // Same locale as the app (app.config.ts), so dates read "8 de noviembre de 2026".
  beforeAll(() => registerLocaleData(localeEsCo));

  async function render<T>(component: Type<T>): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'es-CO' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function routeFor(path: string): Route | undefined {
    return routes.find((route) => route.path === path);
  }

  it.each([
    ['privacidad', 'Política de tratamiento de datos'],
    ['terminos', 'Términos de uso'],
  ])('/%s is a public route with its own title', (path, title) => {
    const route = routeFor(path);

    expect(route).toBeDefined();
    expect(route?.title).toBe(title);
    expect(route?.canActivate).toBeUndefined();
    expect(route?.canMatch).toBeUndefined();
    expect(route?.redirectTo).toBeUndefined();
  });

  describe.each([
    [
      'privacy policy',
      PrivacyPolicyPageComponent as Type<unknown>,
      'Política de tratamiento de datos',
      '/terminos',
    ],
    ['terms of use', TermsOfUsePageComponent as Type<unknown>, 'Términos de uso', '/privacidad'],
  ])('%s', (_name, component, title, relatedRoute) => {
    it('renders one main heading and numbered sections listed in the contents', async () => {
      const element = await render(component);

      const headings = element.querySelectorAll('h1');
      expect(headings).toHaveLength(1);
      expect(headings[0].textContent?.trim()).toBe(title);

      const sectionIds = Array.from(element.querySelectorAll('.legal__section')).map(
        (section) => section.id,
      );
      const tocTargets = Array.from(
        element.querySelectorAll<HTMLAnchorElement>('.legal__toc-link'),
      ).map((link) => link.getAttribute('href')?.split('#')[1]);
      expect(sectionIds.length).toBeGreaterThan(5);
      expect(tocTargets).toEqual(sectionIds);

      for (const section of Array.from(element.querySelectorAll('.legal__section'))) {
        expect(section.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
      }
    });

    it('shows the confirmed business data and no draft markers', async () => {
      const element = await render(component);
      const text = element.textContent ?? '';

      expect(text).toContain(LEGAL_OPERATOR.responsibleName);
      expect(text).toContain(LEGAL_OPERATOR.address);
      expect(text).toContain(LEGAL_OPERATOR.email);
      expect(text).toContain(LEGAL_OPERATOR.whatsapp);
      expect(text).not.toMatch(DRAFT_MARKERS);
      expect(element.querySelector(`a[href="mailto:${LEGAL_OPERATOR.email}"]`)).not.toBeNull();
    });

    it('says the document is under review while it has no effective date', async () => {
      expect(PRIVACY_POLICY_META.effectiveOn).toBeNull();
      expect(TERMS_OF_USE_META.effectiveOn).toBeNull();

      const element = await render(component);

      expect(element.querySelector('[data-testid="legal-review-notice"]')?.textContent).toContain(
        'en revisión',
      );
      expect(
        element.querySelector('[data-testid="legal-meta"]')?.textContent?.replace(/\s+/g, ' '),
      ).toContain('Versión 1.0 · Última actualización: 8 de noviembre de 2026');
    });

    it('links to the other legal document and opens official sources in a new, isolated tab', async () => {
      const element = await render(component);

      expect(element.querySelector(`.legal__related a[href="${relatedRoute}"]`)).not.toBeNull();

      const external = Array.from(
        element.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'),
      );
      for (const link of external) {
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.textContent).toContain('(se abre en una pestaña nueva)');
      }
    });
  });

  it('the policy does not present unbuilt mechanisms as available', async () => {
    const element = await render(PrivacyPolicyPageComponent);
    const text = (element.textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('no tiene una opción para eliminar directamente tu cuenta');
    expect(text).toContain(
      'No realizamos campañas comerciales por correo electrónico ni por WhatsApp',
    );
    expect(text).not.toMatch(/certificad|cumplimos con todas/i);
  });
});
