import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../core/services/connectivity.service';
import { LoadErrorComponent } from './load-error.component';

/** SONDA BUG-045 / BUG-065 / BUG-102: one honest «could not load» state with «Reintentar». */
describe('LoadErrorComponent', () => {
  let fixture: ComponentFixture<LoadErrorComponent>;
  let offline: ReturnType<typeof signal<boolean>>;

  async function create(error: unknown, isOffline = false): Promise<HTMLElement> {
    offline = signal(isOffline);
    await TestBed.configureTestingModule({
      imports: [LoadErrorComponent],
      providers: [{ provide: ConnectivityService, useValue: { isOffline: offline } }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadErrorComponent);
    fixture.componentRef.setInput('error', error);
    fixture.componentRef.setInput('subject', 'el perfil del profesional');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says there is no connection, without claiming saved data or "not found"', async () => {
    const element = await create(new HttpErrorResponse({ status: 0 }));

    expect(element.querySelector('h2')!.textContent).toBe('Sin conexión');
    expect(element.textContent).toContain('no podemos mostrar el perfil del profesional');
    expect(element.textContent).not.toMatch(/guardada|No encontramos/);
  });

  it('with network, says the content could not be loaded', async () => {
    const element = await create(new HttpErrorResponse({ status: 503 }));

    expect(element.querySelector('h2')!.textContent).toBe('No pudimos cargar el perfil del profesional');
  });

  it('follows the device connectivity even when the error alone does not tell', async () => {
    const element = await create(new HttpErrorResponse({ status: 503 }), true);

    expect(element.querySelector('h2')!.textContent).toBe('Sin conexión');
  });

  it('emits «Reintentar» and disables it while retrying', async () => {
    const element = await create(new HttpErrorResponse({ status: 0 }));
    const retried = vi.fn();
    fixture.componentInstance.retry.subscribe(retried);

    element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!.click();
    expect(retried).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('retrying', true);
    fixture.detectChanges();
    const button = element.querySelector<HTMLButtonElement>('[data-testid="load-error-retry"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Reintentando');
  });
});
