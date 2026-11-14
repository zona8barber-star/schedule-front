import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalDialogDirective } from './modal-dialog.directive';

@Component({
  imports: [ModalDialogDirective],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Abrir</button>
    @if (open()) {
      <div class="overlay" (click)="open.set(false)">
        <div appModalDialog (modalClose)="open.set(false)" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
          <h2>Agendar cita</h2>
          <input id="first" />
          <button id="last" type="button">Guardar</button>
        </div>
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

/** SONDA BUG-052 / BUG-062: one modal behaviour for the whole app. */
describe('ModalDialogDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    fixture.detectChanges();
  });

  afterEach(() => element.remove());

  async function openModal(): Promise<HTMLElement> {
    const opener = element.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await Promise.resolve();
    return element.querySelector<HTMLElement>('[appModalDialog]')!;
  }

  it('is a named modal dialog and moves the focus inside', async () => {
    const dialog = await openModal();

    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = dialog.querySelector('h2')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(document.activeElement?.id).toBe('first');
  });

  it('closes with Escape even when the card stops the keyboard events, and gives the focus back', async () => {
    const dialog = await openModal();

    dialog.querySelector<HTMLInputElement>('#first')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('[appModalDialog]')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('keeps Tab inside the dialog', async () => {
    const dialog = await openModal();
    const last = dialog.querySelector<HTMLButtonElement>('#last')!;
    last.focus();

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
  });
});
