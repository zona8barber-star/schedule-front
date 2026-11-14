import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaPreviewComponent, isPdfUrl } from './media-preview.component';

@Component({
  imports: [MediaPreviewComponent],
  template: `
    <app-media-preview [url]="url()">
      <img class="thumb" [src]="url()" alt="QR de propinas" />
    </app-media-preview>
  `,
})
class HostComponent {
  readonly url = signal('https://cdn.test/media/tips-qr/qr.png');
}

/** SONDA BUG-073: a PDF tips QR, or an image that does not load, is never a broken image. */
describe('MediaPreviewComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('shows the image of an image file with the page styles', () => {
    expect(element.querySelector('img.thumb')).not.toBeNull();
    expect(element.querySelector('[data-testid="media-preview-doc"]')).toBeNull();
  });

  it('shows a document with a link for a PDF', () => {
    fixture.componentInstance.url.set('https://cdn.test/media/tips-qr/qr.pdf');
    fixture.detectChanges();

    const link = element.querySelector<HTMLAnchorElement>('[data-testid="media-preview-doc"]')!;
    expect(link.href).toBe('https://cdn.test/media/tips-qr/qr.pdf');
    expect(link.textContent).toContain('Abrir el PDF');
    expect(element.querySelector('img')).toBeNull();
  });

  it('replaces an image that fails to load', () => {
    element.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="media-preview-doc"]')).not.toBeNull();
  });

  it('recognises PDF addresses', () => {
    expect(isPdfUrl('https://x.test/a/qr.PDF?v=2')).toBe(true);
    expect(isPdfUrl('https://x.test/a/qr.jpg')).toBe(false);
    expect(isPdfUrl(null)).toBe(false);
  });
});
