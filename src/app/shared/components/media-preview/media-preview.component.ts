import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal } from '@angular/core';

/** True when the address points at a PDF (stored files keep the extension of their real type). */
export function isPdfUrl(url: string | null | undefined): boolean {
  return !!url && /\.pdf(?:$|[?#])/i.test(url);
}

/**
 * SONDA BUG-073: a tips QR uploaded as a PDF (an allowed format) showed a broken image. A PDF, or an image that fails
 * to load, is shown as a document with a link to open it instead of the broken-image icon.
 */
@Component({
  selector: 'app-media-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showDocument()) {
      <a class="media-preview__doc" [href]="url()" target="_blank" rel="noopener" data-testid="media-preview-doc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
        <span>{{ documentLabel() }}</span>
      </a>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .media-preview__doc {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-width: 8rem;
      min-height: 8rem;
      padding: 0.75rem;
      border: 1px dashed var(--color-border, rgba(176, 138, 74, 0.45));
      border-radius: 10px;
      color: var(--color-text);
      font-size: 0.85rem;
      font-weight: 600;
      text-align: center;
      text-decoration: underline;
    }

    .media-preview__doc svg {
      width: 2.25rem;
      height: 2.25rem;
      color: var(--z-brass-dk, #8f6f38);
    }
  `,
})
export class MediaPreviewComponent {
  readonly url = input.required<string>();
  /** Set when the caller knows the file is a PDF (e.g. a local preview of a selected file). */
  readonly pdf = input(false);
  readonly documentLabel = input('Abrir el PDF');

  readonly failed = signal(false);
  readonly showDocument = computed(() => this.pdf() || isPdfUrl(this.url()) || this.failed());

  constructor() {
    // The projected <img> keeps the styles of the page that owns it; its load error (which does not bubble) is
    // caught here in the capture phase.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        this.failed.set(true);
      }
    };
    host.addEventListener("error", onError, true);
    inject(DestroyRef).onDestroy(() => host.removeEventListener("error", onError, true));

    // A new file gets a new chance to load as an image.
    effect(() => {
      this.url();
      this.failed.set(false);
    });
  }
}
