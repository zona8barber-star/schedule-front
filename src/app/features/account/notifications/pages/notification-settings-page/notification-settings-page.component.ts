import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PushTestResultResponse } from '../../../../../core/models/notification.models';
import {
  PushNotificationService,
  PushStatus,
} from '../../../../../core/services/push-notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

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
  imports: [ApiFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-settings-page.component.html',
  styleUrl: './notification-settings-page.component.scss',
})
export class NotificationSettingsPageComponent {
  readonly push = inject(PushNotificationService);
  private readonly toastService = inject(ToastService);

  readonly isDisabling = signal(false);
  readonly isTesting = signal(false);
  readonly testResult = signal<PushTestResultResponse | null>(null);
  readonly testError = signal<string | null>(null);

  readonly status = this.push.status;
  readonly copy = computed(() => STATUS_COPY[this.status()]);

  readonly testSummary = computed(() => {
    const result = this.testResult();
    if (!result) {
      return null;
    }

    if (result.deviceCount === 0) {
      return 'No hay dispositivos registrados para tu cuenta.';
    }

    return result.deliveredCount === result.deviceCount
      ? `Enviada a ${result.deviceCount} dispositivo(s). Debería llegarte en unos segundos.`
      : `Entregada a ${result.deliveredCount} de ${result.deviceCount} dispositivo(s).`;
  });

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
      this.testResult.set(null);
      this.toastService.info('Notificaciones desactivadas en este dispositivo');
    } finally {
      this.isDisabling.set(false);
    }
  }

  async sendTest(): Promise<void> {
    this.isTesting.set(true);
    this.testError.set(null);
    this.testResult.set(null);

    try {
      this.testResult.set(await this.push.sendTest());
    } catch (error) {
      this.testError.set(getApiErrorMessage(error, 'No pudimos enviar la notificación de prueba.'));
    } finally {
      this.isTesting.set(false);
    }
  }

  describeStatusCode(statusCode: number | null): string {
    switch (statusCode) {
      case 401:
      case 403:
        return 'el servicio push rechazó la firma del servidor (revisa las llaves VAPID y el correo de contacto)';
      case 404:
      case 410:
        return 'la suscripción ya no existe';
      case 413:
        return 'el mensaje es demasiado grande';
      case 429:
        return 'demasiados envíos, intenta en un momento';
      case null:
        return 'error de red';
      default:
        return `código ${statusCode}`;
    }
  }
}
