import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import {
  BAR_DIMMEST_TEXT,
  BRAND_PROPERTIES,
  MIN_BRAND_CONTRAST,
  MIN_INDICATOR_CONTRAST,
  ThemeService,
  contrastRatio,
  readableBrandColor,
} from './theme.service';

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

  // ADR-0021 L7: SONDA saw the content in the brand color but the side and top bars still black.
  it('paints the bars with the primary color, keeping every text of the bars readable', () => {
    service.applyBranding({ primaryColor: '#0000ff', secondaryColor: '#ff0000' });

    const bar = root.getPropertyValue('--z-bar');
    expect(bar).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrastRatio(bar, BAR_DIMMEST_TEXT)).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    expect(contrastRatio(bar, '#f4f2ec')).toBeGreaterThanOrEqual(MIN_BRAND_CONTRAST);
    // Same hue: blue stays blue, only darker.
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(bar.slice(start, start + 2), 16));
    expect(b).toBeGreaterThan(r + g);
  });

  it('marks the active item with the secondary color only when it stands out on the bar', () => {
    service.applyBranding({ primaryColor: '#111111', secondaryColor: '#c59d5f' });
    expect(root.getPropertyValue('--z-bar')).toBe('#111111');
    expect(root.getPropertyValue('--z-bar-accent')).toBe('#c59d5f');
    expect(contrastRatio('#c59d5f', '#111111')).toBeGreaterThanOrEqual(MIN_INDICATOR_CONTRAST);

    // A secondary as dark as the bar would be invisible: the light text of the bars marks it instead.
    service.applyBranding({ primaryColor: '#111111', secondaryColor: '#222222' });
    expect(root.getPropertyValue('--z-bar-accent')).toBe('#f4f2ec');
  });

  it('gives the bars back to the stylesheet without a brand', () => {
    service.applyBranding({ primaryColor: '#0000ff', secondaryColor: '#ff0000' });
    service.applyBranding(null);

    expect(root.getPropertyValue('--z-bar')).toBe('');
    expect(root.getPropertyValue('--z-bar-accent')).toBe('');
  });

  it('never touches the status colors', () => {
    service.applyBranding({ primaryColor: '#ff0000', secondaryColor: '#00ff00' });

    expect(root.getPropertyValue('--color-error')).toBe('');
    expect(root.getPropertyValue('--color-success')).toBe('');
  });
});
