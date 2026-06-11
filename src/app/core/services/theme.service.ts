import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { BrandingSettingsResponse } from '../models/content.models';

const defaultBrandPrimary = '#9c8556';
const defaultBrandAccent = '#b79c6c';
const hexColorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  applyBranding(
    branding: Pick<BrandingSettingsResponse, 'primaryColor' | 'secondaryColor'> | null,
  ): void {
    const rootStyle = this.document.documentElement.style;

    const primaryColor = this.resolveColor(branding?.primaryColor, defaultBrandPrimary);
    const secondaryColor = this.resolveColor(branding?.secondaryColor, defaultBrandAccent);

    rootStyle.setProperty('--brand-primary', primaryColor);
    rootStyle.setProperty('--brand-accent', secondaryColor);
    rootStyle.setProperty('--color-secondary', primaryColor);
    rootStyle.setProperty('--color-secondary-hover', secondaryColor);
  }

  private resolveColor(value: string | undefined, fallback: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      return fallback;
    }

    return hexColorPattern.test(normalized) ? normalized : fallback;
  }
}
