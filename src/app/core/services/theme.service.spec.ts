import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { BRAND_PROPERTIES, MIN_BRAND_CONTRAST, ThemeService, contrastRatio, readableBrandColor } from './theme.service';

/** ADR-0018 D9 (pending of SONDA BUG-100): the brand colors reach the panel, always readable. */
describe('ThemeService', () => {
  let service: ThemeService;
  let root: CSSStyleDeclaration;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    root = TestBed.inject(DOCUMENT).documentElement.style;
  });

  afterEach(() => service.applyBranding(null));

  const readable = (color: string) =>
    Math.min(contrastRatio(color, '#ffffff'), contrastRatio(color, '#f4f2ec')) >= MIN_BRAND_CONTRAST;

  it('uses a configured color as it is when it already reads on light surfaces and under white text', () => {
    service.applyBranding({ primaryColor: '#1d4e89', secondaryColor: '#5b2a86' });

    expect(root.getPropertyValue('--z-brass')).toBe('#1d4e89');
    expect(root.getPropertyValue('--color-secondary')).toBe('#1d4e89');
    expect(root.getPropertyValue('--brand-primary')).toBe('#1d4e89');
    expect(root.getPropertyValue('--brand-accent')).toBe('#5b2a86');
    expect(readable(root.getPropertyValue('--z-brass-dk'))).toBe(true);
  });

  it('replaces a color without enough contrast by the same hue darkened until it reads', () => {
    service.applyBranding({ primaryColor: '#ffd400', secondaryColor: '#f0f0f0' });

    const accent = root.getPropertyValue('--z-brass');
    expect(accent).not.toBe('#ffd400');
    expect(readable(accent)).toBe(true);
    expect(readable(root.getPropertyValue('--brand-accent'))).toBe(true);
    // Same hue: red stays above blue, as in the yellow chosen.
    const [r, , b] = [1, 3, 5].map((start) => parseInt(accent.slice(start, start + 2), 16));
    expect(r).toBeGreaterThan(b);
  });

  it('accepts the short hex form', () => {
    expect(readableBrandColor('#000')).toBe('#000000');
  });

  it('leaves the stylesheet palette untouched without a valid brand color', () => {
    service.applyBranding({ primaryColor: '#123456', secondaryColor: '#654321' });
    service.applyBranding({ primaryColor: 'rojo', secondaryColor: '' });

    for (const property of BRAND_PROPERTIES) {
      expect(root.getPropertyValue(property)).toBe('');
    }
  });

  it('never touches the status colors', () => {
    service.applyBranding({ primaryColor: '#ff0000', secondaryColor: '#00ff00' });

    expect(root.getPropertyValue('--color-error')).toBe('');
    expect(root.getPropertyValue('--color-success')).toBe('');
  });
});
