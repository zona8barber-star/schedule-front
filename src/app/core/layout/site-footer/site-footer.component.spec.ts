import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import {
  DEVELOPER_CREDIT,
  DEVELOPER_CREDIT_CONFIG,
  DeveloperCreditConfig,
  buildDeveloperCredit,
} from '../../config/developer-credit.config';
import { SiteFooterComponent } from './site-footer.component';

@Component({ template: '' })
class StubPageComponent {}

describe('SiteFooterComponent', () => {
  async function render(credit?: DeveloperCreditConfig): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [
        provideRouter([
          { path: 'privacidad', component: StubPageComponent },
          { path: 'terminos', component: StubPageComponent },
        ]),
        ...(credit ? [{ provide: DEVELOPER_CREDIT_CONFIG, useValue: credit }] : []),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the current year and the trade name', async () => {
    const element = await render();

    expect(element.querySelector('[data-testid="site-footer-copy"]')?.textContent?.trim()).toBe(
      `© ${new Date().getFullYear()} Zona 8`,
    );
  });

  it('links to the privacy policy and the terms of use as real, keyboard-focusable links', async () => {
    const element = await render();

    const privacy = element.querySelector<HTMLAnchorElement>('[data-testid="footer-privacy-link"]');
    const terms = element.querySelector<HTMLAnchorElement>('[data-testid="footer-terms-link"]');

    expect(privacy?.textContent?.trim()).toBe('Política de tratamiento de datos');
    expect(privacy?.getAttribute('href')).toBe('/privacidad');
    expect(terms?.textContent?.trim()).toBe('Términos de uso');
    expect(terms?.getAttribute('href')).toBe('/terminos');
    expect(element.querySelector('nav[aria-label="Información legal"]')).not.toBeNull();
  });

  it('marks the legal link of the current page', async () => {
    const element = await render();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/terminos');
    TestBed.tick();

    expect(
      element.querySelector('[data-testid="footer-terms-link"]')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(
      element.querySelector('[data-testid="footer-privacy-link"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('shows the confirmed developer credit by default', async () => {
    expect(DEVELOPER_CREDIT).toEqual({ name: 'diazbetancur', email: 'diazbetancur@gmail.com' });

    const element = await render();

    const credit = element.querySelector('[data-testid="developer-credit"]');
    const link = credit?.querySelector<HTMLAnchorElement>('a');

    expect(credit?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Desarrollado por diazbetancur');
    expect(link?.textContent?.trim()).toBe('diazbetancur');
    expect(link?.getAttribute('href')).toBe(
      'mailto:diazbetancur@gmail.com?subject=Consulta%20sobre%20desarrollo%20web',
    );
    expect(link?.hasAttribute('target')).toBe(false);
    expect(element.textContent).not.toContain('[');
  });

  it('shows no developer credit when the developer data is blank', async () => {
    const element = await render({ name: '', email: '' });

    expect(element.querySelector('[data-testid="developer-credit"]')).toBeNull();
    expect(element.textContent).not.toContain('Desarrollado por');
    expect(element.textContent).not.toContain('[');
  });

  it('shows the developer credit as a mailto link with the agreed subject once configured', async () => {
    const element = await render({ name: 'Estudio Ejemplo', email: 'hola@ejemplo.dev' });

    const credit = element.querySelector('[data-testid="developer-credit"]');
    const link = credit?.querySelector<HTMLAnchorElement>('a');

    expect(credit?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Desarrollado por Estudio Ejemplo',
    );
    expect(link?.getAttribute('href')).toBe(
      'mailto:hola@ejemplo.dev?subject=Consulta%20sobre%20desarrollo%20web',
    );
  });
});

describe('buildDeveloperCredit', () => {
  it('rejects blank values, placeholders and invalid addresses', () => {
    expect(buildDeveloperCredit({ name: '', email: 'hola@ejemplo.dev' })).toBeNull();
    expect(buildDeveloperCredit({ name: 'Estudio', email: '  ' })).toBeNull();
    expect(
      buildDeveloperCredit({ name: '[TU NOMBRE O MARCA]', email: 'hola@ejemplo.dev' }),
    ).toBeNull();
    expect(buildDeveloperCredit({ name: 'Estudio', email: '[TU CORREO PROFESIONAL]' })).toBeNull();
    expect(buildDeveloperCredit({ name: 'Estudio', email: 'no-es-un-correo' })).toBeNull();
  });

  it("never uses the business' own e-mail as the developer contact", () => {
    expect(buildDeveloperCredit({ name: 'Estudio', email: 'Zona8Barber@gmail.com' })).toBeNull();
  });

  it('trims the configured values', () => {
    expect(buildDeveloperCredit({ name: '  Estudio  ', email: ' hola@ejemplo.dev ' })).toEqual({
      name: 'Estudio',
      href: 'mailto:hola@ejemplo.dev?subject=Consulta%20sobre%20desarrollo%20web',
    });
  });
});
