import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input, output } from '@angular/core';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Open modals, the last one on top: only it answers Escape and keeps the focus. */
const openModals: ModalDialogDirective[] = [];
let nextLabelId = 1;

/**
 * SONDA BUG-052 / BUG-062: one modal behaviour for the whole app. On the element that holds the modal content:
 * role="dialog" + aria-modal, an accessible name (aria-labelledby to its first heading unless given), the focus moves
 * inside when it opens and stays inside with Tab, Escape asks to close (`modalClose`), and when it closes the focus
 * goes back to whatever opened it.
 */
@Directive({
  selector: '[appModalDialog]',
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.tabindex]': '"-1"',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalDialogDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly opener = (globalThis.document?.activeElement as HTMLElement | null) ?? null;
  private readonly onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.isTopmost()) {
      event.preventDefault();
      event.stopPropagation();
      this.modalClose.emit();
    }
  };

  /** Accessible name when the modal has no visible heading. */
  readonly modalLabel = input<string | null>(null);
  /** Id of the element that names the modal; by default its first heading. */
  readonly modalLabelledBy = input<string | null>(null);
  /** Escape was pressed: the owner closes the modal. */
  readonly modalClose = output<void>();

  private labelledBy: string | null = null;

  constructor() {
    openModals.push(this);
    // Capture phase: a <dialog> or a card that stops propagation must not swallow Escape.
    globalThis.document?.addEventListener('keydown', this.onDocumentKeydown, true);
  }

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    // A name the template already gives (aria-label / aria-labelledby) is kept.
    const named = element.hasAttribute('aria-labelledby') || element.hasAttribute('aria-label');
    this.labelledBy = this.modalLabelledBy() ?? (this.modalLabel() || named ? null : this.headingId(element));
    if (this.labelledBy) {
      element.setAttribute('aria-labelledby', this.labelledBy);
    }
    if (this.modalLabel()) {
      element.setAttribute('aria-label', this.modalLabel()!);
    }

    // After the content is rendered: the first field, else the first control, else the modal itself.
    queueMicrotask(() => {
      if (!element.isConnected || element.contains(globalThis.document?.activeElement ?? null)) {
        return;
      }
      const target =
        element.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ??
        this.focusable()[0] ??
        element;
      target.focus({ preventScroll: false });
    });
  }

  ngOnDestroy(): void {
    globalThis.document?.removeEventListener('keydown', this.onDocumentKeydown, true);
    const index = openModals.indexOf(this);
    if (index >= 0) {
      openModals.splice(index, 1);
    }

    // Back to the control that opened it (BUG-052: the focus fell on BODY).
    if (this.opener && this.opener !== globalThis.document?.body && this.opener.isConnected) {
      this.opener.focus({ preventScroll: true });
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isTopmost()) {
      return;
    }

    const focusable = this.focusable();
    if (focusable.length === 0) {
      event.preventDefault();
      this.host.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = globalThis.document?.activeElement;
    if (event.shiftKey && (active === first || active === this.host.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private isTopmost(): boolean {
    return openModals[openModals.length - 1] === this;
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (candidate) => !candidate.hasAttribute('inert') && candidate.getAttribute('aria-hidden') !== 'true',
    );
  }

  private headingId(element: HTMLElement): string | null {
    const heading = element.querySelector<HTMLElement>('h1, h2, h3');
    if (!heading) {
      return null;
    }
    if (!heading.id) {
      heading.id = `modal-title-${nextLabelId++}`;
    }
    return heading.id;
  }
}
