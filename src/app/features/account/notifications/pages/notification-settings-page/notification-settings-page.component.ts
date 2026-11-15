import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NotificationCategory, NotificationPreference } from '../../../../../core/models/notification.models';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';

import {
  PushNotificationService,
  PushStatus,
} from '../../../../../core/services/push-notification.service';
import { ToastService } from '../../../../../core/services/toast.service';

/** ADR-0019 N4: tipos de aviso que el usuario puede apagar, en el orden en que se muestran. */
export const NOTIFICATION_CATEGORY_COPY: Record<NotificationCategory, { label: string; description: string }> = {
  appointments: {
    label: 'Citas',
    description: 'Reservas, confirmaciones, cambios, cancelaciones y recordatorios.',
  },
  memberships: {
    label: 'Membresías',
    description: 'Venta, activación, cada servicio que uses y el aviso de vencimiento.',
  },
  loyalty: {
    label: 'Puntos',
    description: 'Puntos ganados o retirados, canjes aprobados o rechazados y puntos por vencer.',
  },
  purchases: {
    label: 'Compras',
    description: 'El comprobante de cada cuenta que pagas en la barbería.',
  },
  campaigns: {
    label: 'Campañas',
    description: 'Novedades y promociones de la barbería.',
  },
};

interface StatusCopy {
  label: string;
  description: string;
  tone: 'ok' | 'off' | 'warn';
}

const STATUS_COPY: Record<PushStatus, StatusCopy> = {
  enabled: {
    label: 'Activadas en este dispositivo',
    description: 'Te avisaremos de tus citas, membresías, puntos, compras y campañas, según los tipos que elijas abajo.',
    tone: 'ok',
  },
  disabled: {
    label: 'Desactivadas en este dispositivo',
    description: 'Actívalas para enterarte al instante de los cambios en tus citas.',
    tone: 'off',
  },
  checking: {
    label: 'Comprobando...',
    description: 'Estamos confirmando con el servidor que este dispositivo quedó registrado.',
    tone: 'off',
  },
  unconfirmed: {
    label: 'No activadas en este dispositivo',
    description:
      'El servidor no pudo registrar este dispositivo, así que no te llegarán notificaciones. Revisa tu conexión y vuelve a intentarlo.',
    tone: 'warn',
  },
  blocked: {
    label: 'Bloqueadas por el navegador',
    description:
      'Las bloqueaste antes, así que la app no puede volver a pedir permiso. Actívalas desde los ajustes del sitio o del teléfono y recarga esta página.',
    tone: 'warn',
  },
  'needs-install': {
    label: 'Instala la app para recibirlas',
    description:
      'En iPhone y iPad las notificaciones solo funcionan con la app instalada: toca Compartir → "Agregar a inicio", abre la app desde el ícono y vuelve a esta pantalla.',
    tone: 'warn',
  },
  'not-configured': {
    label: 'No disponibles por ahora',
    description: 'Las notificaciones no están configuradas en el servidor. Avísale al administrador.',
    tone: 'warn',
  },
  unsupported: {
    label: 'No compatibles con este navegador',
    description: 'Prueba desde Chrome, Edge, Firefox o Safari actualizados, o instala la app.',
    tone: 'warn',
  },
};

@Component({
  selector: 'app-notification-settings-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-settings-page.component.html',
  styleUrl: './notification-settings-page.component.scss',
})
export class NotificationSettingsPageComponent implements OnInit {
  readonly push = inject(PushNotificationService);
  private readonly toastService = inject(ToastService);
  private readonly notificationsApi = inject(NotificationsApiService);

  readonly categoryCopy = NOTIFICATION_CATEGORY_COPY;
  readonly preferences = signal<NotificationPreference[]>([]);
  readonly preferencesError = signal<string | null>(null);
  readonly isLoadingPreferences = signal(true);
  /** Tipo que se está guardando (evita dos cambios a la vez). */
  readonly savingCategory = signal<NotificationCategory | null>(null);

  readonly isDisabling = signal(false);

  readonly status = this.push.status;
  readonly copy = computed(() => STATUS_COPY[this.status()]);

  ngOnInit(): void {
    void this.loadPreferences();
  }

  /** Guarda al instante; si falla, el interruptor vuelve a como estaba. */
  async togglePreference(category: NotificationCategory, input: HTMLInputElement): Promise<void> {
    const pushEnabled = input.checked;
    if (this.savingCategory()) {
      input.checked = !pushEnabled;
      return;
    }

    const previous = this.preferences();
    const label = NOTIFICATION_CATEGORY_COPY[category].label.toLowerCase();
    this.savingCategory.set(category);
    this.preferences.update((items) => items.map((item) => (item.category === category ? { ...item, pushEnabled } : item)));

    try {
      const saved = await firstValueFrom(this.notificationsApi.updatePreferences({ categories: [{ category, pushEnabled }] }));
      this.preferences.set(saved.categories.filter((item) => item.category in NOTIFICATION_CATEGORY_COPY));
      this.toastService.success(pushEnabled ? `Recibirás los avisos de ${label}` : `Ya no recibirás avisos push de ${label}`);
    } catch (error) {
      this.preferences.set(previous);
      // La señal vuelve al valor que ya estaba pintado, así que Angular no reescribe el DOM: se corrige a mano.
      input.checked = !pushEnabled;
      this.toastService.error(getApiErrorMessage(error, 'No pudimos guardar tu preferencia. Intenta de nuevo.'));
    } finally {
      this.savingCategory.set(null);
    }
  }

  private async loadPreferences(): Promise<void> {
    this.isLoadingPreferences.set(true);
    this.preferencesError.set(null);
    try {
      const result = await firstValueFrom(this.notificationsApi.getPreferences());
      this.preferences.set(result.categories.filter((item) => item.category in NOTIFICATION_CATEGORY_COPY));
    } catch (error) {
      this.preferencesError.set(getApiErrorMessage(error, 'No pudimos cargar tus preferencias. Recarga la página.'));
    } finally {
      this.isLoadingPreferences.set(false);
    }
  }

  async enable(): Promise<void> {
    const error = await this.push.enable();

    if (error) {
      this.toastService.error(error);
    } else if (this.push.isSubscribed()) {
      this.toastService.success('Notificaciones activadas en este dispositivo');
    }
  }

  async disable(): Promise<void> {
    this.isDisabling.set(true);

    try {
      await this.push.disable();
      this.toastService.info('Notificaciones desactivadas en este dispositivo');
    } finally {
      this.isDisabling.set(false);
    }
  }
}
