import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, NavigationSkipped, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface NavigationFailure {
  url: string;
  error: unknown;
}

/**
 * SONDA BUG-065: a page whose code could not be downloaded (no network before the service worker finished caching
 * the app, or a chunk that failed) used to leave the screen blank. The failure is kept here so the shell shows the
 * common «Sin conexión» state with «Reintentar» instead, and the page is opened again when the network is back.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationFailureService {
  private readonly router = inject(Router);
  private readonly failureState = signal<NavigationFailure | null>(null);
  private readonly retryingState = signal(false);

  readonly failure = this.failureState.asReadonly();
  readonly isRetrying = this.retryingState.asReadonly();

  constructor() {
    this.router.events
      .pipe(
        // Skipped: a link to the page already on screen (e.g. «Inicio» after failing to open another page).
        filter((event) => event instanceof NavigationEnd || event instanceof NavigationSkipped),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.failureState.set(null));

    const onOnline = () => {
      if (this.failureState()) {
        void this.retry();
      }
    };
    globalThis.addEventListener?.('online', onOnline);
    inject(DestroyRef).onDestroy(() => globalThis.removeEventListener?.('online', onOnline));
  }

  /** Called by the router's navigation error handler. */
  report(error: NavigationError): void {
    this.failureState.set({ url: error.url, error: error.error });
  }

  async retry(): Promise<void> {
    const failure = this.failureState();
    if (!failure || this.retryingState()) {
      return;
    }

    this.retryingState.set(true);
    try {
      // The browser remembers a module that failed to download and fails the same import again, so a page whose
      // code did not arrive is opened with a full load; other failures go through the router.
      if (isModuleLoadError(failure.error)) {
        this.reloadPage(failure.url);
        return;
      }

      await this.router.navigateByUrl(failure.url);
    } catch {
      // A new failure is reported again by the error handler.
    } finally {
      this.retryingState.set(false);
    }
  }

  /** Full page load of the app URL (overridable in tests). */
  protected reloadPage(url: string): void {
    globalThis.location?.assign(url);
  }
}

/** Chrome/Edge, Safari and Firefox wording for a lazy page whose code could not be downloaded. */
export function isModuleLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror|loading chunk/i.test(
    text,
  );
}
