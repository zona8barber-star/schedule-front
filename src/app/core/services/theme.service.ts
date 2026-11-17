import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { BrandingSettingsResponse } from '../models/content.models';

const hexColorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** WCAG AA for normal text. */
export const MIN_BRAND_CONTRAST = 4.5;

/** The light surfaces brand colors sit on (white cards and the bone background) and the white text of buttons. */
const LIGHT_SURFACES = ['#ffffff', '#f4f2ec'] as const;

/**
 * The CSS custom properties the brand drives. Without a configured brand none is set, so the stylesheet palette
 * (styles/theme.scss) applies unchanged.
 */
export const BRAND_PROPERTIES = [
  '--z-brass',
  '--z-brass-dk',
  '--z-brass-dark',
  '--color-secondary',
  '--color-secondary-hover',
  '--brand-primary',
  '--brand-accent',
] as const;

/**
 * Applies the colors configured in «Marca» to the whole app, the administration panel included (ADR-0018 D9, pending
 * of SONDA BUG-100). Every color is checked for contrast against the light surfaces and the white text of buttons;
 * one below 4.5:1 is replaced by the same hue darkened until it reaches it, so nothing becomes unreadable. Status
 * colors (error, success) are never touched.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  applyBranding(branding: Pick<BrandingSettingsResponse, 'primaryColor' | 'secondaryColor'> | null): void {
    const rootStyle = this.document.documentElement.style;
    const primary = parseHex(branding?.primaryColor);
    if (!primary) {
      for (const property of BRAND_PROPERTIES) {
        rootStyle.removeProperty(property);
      }
      return;
    }

    const accent = readableBrandColor(primary);
    const hover = toHex(darken(hexToRgb(accent), 0.18));
    const secondary = parseHex(branding?.secondaryColor);
    const secondaryAccent = secondary ? readableBrandColor(secondary) : hover;

    rootStyle.setProperty('--z-brass', accent);
    rootStyle.setProperty('--z-brass-dk', hover);
    rootStyle.setProperty('--z-brass-dark', hover);
    rootStyle.setProperty('--color-secondary', accent);
    rootStyle.setProperty('--color-secondary-hover', hover);
    rootStyle.setProperty('--brand-primary', accent);
    rootStyle.setProperty('--brand-accent', secondaryAccent);
  }
}

/** The color itself when it reads on every light surface (and under white text); otherwise the same hue darkened. */
export function readableBrandColor(hex: string): string {
  let rgb = hexToRgb(hex);
  for (let step = 0; step < 40 && minContrast(rgb) < MIN_BRAND_CONTRAST; step++) {
    rgb = darken(rgb, 0.06);
  }

  return toHex(rgb);
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(hexToRgb(first));
  const b = luminance(hexToRgb(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function minContrast(rgb: Rgb): number {
  return Math.min(...LIGHT_SURFACES.map((surface) => contrastRatio(toHex(rgb), surface)));
}

type Rgb = [number, number, number];

function parseHex(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && hexColorPattern.test(normalized) ? toHex(hexToRgb(normalized)) : null;
}

function hexToRgb(hex: string): Rgb {
  let digits = hex.replace('#', '');
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((digit) => digit + digit)
      .join('');
  }

  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function darken(rgb: Rgb, amount: number): Rgb {
  return rgb.map((channel) => Math.max(0, channel * (1 - amount))) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
