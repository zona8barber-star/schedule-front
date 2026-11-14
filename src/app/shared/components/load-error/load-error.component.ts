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
  readonly title = computed(() => (this.offline() ? 'Sin conexión' : `No pudimos cargar ${this.subject()}`));
  readonly message = computed(() =>
    this.offline()
      ? `No hay conexión a internet, así que no podemos mostrar ${this.subject()}. Revisa tu red y vuelve a intentarlo.`
      : 'Puede ser un problema momentáneo del servidor. Vuelve a intentarlo en unos segundos.',
  );
}
