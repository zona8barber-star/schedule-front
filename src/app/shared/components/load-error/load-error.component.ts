import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ConnectivityService } from '../../../core/services/connectivity.service';
import { isConnectivityError } from '../../../core/utils/api-error.utils';

/**
 * Common "could not load" state with «Reintentar» (SONDA BUG-045, BUG-065, BUG-102). Without network it says so
 * plainly instead of claiming saved data or "not found"; with network it says the content could not be loaded.
 */
@Component({
  selector: 'app-load-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './load-error.component.html',
  styleUrl: './load-error.component.scss',
})
export class LoadErrorComponent {
  private readonly connectivity = inject(ConnectivityService);

  /** The error that stopped the load; a network failure shows the offline text. */
  readonly error = input<unknown>(null);
  /** What could not be loaded, e.g. «el perfil del profesional». */
  readonly subject = input('esta información');
  readonly retrying = input(false);

  readonly retry = output<void>();

  readonly offline = computed(() => this.connectivity.isOffline() || isConnectivityError(this.error()));

  /**
   * SONDA BUG-185: a 403 of the API (a permission revoked while the screen was open) is not a momentary problem of the
   * server, and retrying does not help: it says so and offers no «Reintentar». The security filter's block (lote M) is
   * a 403 too, but about a text, so it keeps the usual state.
   */
  readonly forbidden = computed(() => {
    const error = this.error();
    return (
      !this.offline() &&
      error instanceof HttpErrorResponse &&
      error.status === 403 &&
      (error.error as { code?: string } | null)?.code !== 'perimeter_blocked'
    );
  });

  readonly title = computed(() =>
    this.offline() ? 'Sin conexión' : this.forbidden() ? `Ya no tienes acceso ${withA(this.subject())}` : `No pudimos cargar ${this.subject()}`,
  );
  readonly message = computed(() =>
    this.offline()
      ? `No hay conexión a internet, así que no podemos mostrar ${this.subject()}. Revisa tu red y vuelve a intentarlo.`
      : this.forbidden()
        ? 'Tu permiso para ver esto cambió mientras tenías la pantalla abierta. Si lo necesitas, pídeselo a la administración.'
        : 'Puede ser un problema momentáneo del servidor. Vuelve a intentarlo en unos segundos.',
  );
}

/** «a» + subject, with the contraction «al» («el cierre de caja» → «al cierre de caja»). */
function withA(subject: string): string {
  return subject.startsWith('el ') ? `al ${subject.slice(3)}` : `a ${subject}`;
}
