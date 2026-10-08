import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  PushNotificationService,
  PushStatus,
} from '../../../../../core/services/push-notification.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface StatusCopy {
  label: string;
  description: string;
  tone: 'ok' | 'off' | 'warn';
}

const STATUS_COPY: Record<PushStatus, StatusCopy> = {
  enabled: {
    label: 'Activadas en este dispositivo',
    description: 'Te avisaremos de citas nuevas, confirmadas, modificadas o canceladas.',
    tone: 'ok',
  },
  disabled: {
    label: 'Desactivadas en este dispositivo',
    description: 'Actívalas para enterarte al instante de los cambios en tus citas.',
    tone: 'off',
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-settings-page.component.html',
  styleUrl: './notification-settings-page.component.scss',
})
export class NotificationSettingsPageComponent {
  readonly push = inject(PushNotificationService);
  private readonly toastService = inject(ToastService);

  readonly isDisabling = signal(false);

  readonly status = this.push.status;
  readonly copy = computed(() => STATUS_COPY[this.status()]);

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
