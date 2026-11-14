import { Injectable, computed, inject, signal } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicBrandingResponse } from '../models/content.models';
import { PublicContentApiService } from './public-content-api.service';

/** Shown when the branding is not configured or could not be read. */
export const DEFAULT_APP_NAME = 'Zona 8';
export const DEFAULT_LOGO_URL = 'assets/images/logo_black.jpeg';

/**
 * The public branding (name and logo configured in «Marca»), read once and shared by the shell header, the landing
 * and the browser tab title (SONDA BUG-100). The static name and logo are only the fallback.
 */
@Injectable({ providedIn: 'root' })
export class PublicBrandingStore {
  private readonly api = inject(PublicContentApiService);
  private pending: Promise<PublicBrandingResponse> | null = null;

  readonly branding = signal<PublicBrandingResponse | null>(null);
  readonly appName = computed(() => this.branding()?.appName?.trim() || DEFAULT_APP_NAME);
  readonly logoUrl = computed(() => this.branding()?.logoUrl?.trim() || DEFAULT_LOGO_URL);

  /** One request for everyone; a failed read is not cached, so a later call retries. */
  load(): Promise<PublicBrandingResponse> {
    this.pending ??= firstValueFrom(this.api.getBranding()).then(
      (branding) => {
        this.branding.set(branding);
        return branding;
      },
      (error: unknown) => {
        this.pending = null;
        throw error;
      },
    );
    return this.pending;
  }
}

/** Browser tab title of the landing: the configured name, the static one as fallback. */
export const brandTitleResolver: ResolveFn<string> = () =>
  inject(PublicBrandingStore)
    .load()
    .then((branding) => branding.appName?.trim() || DEFAULT_APP_NAME)
    .catch(() => DEFAULT_APP_NAME);
