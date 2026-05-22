# Barbershop PWA Frontend

Angular 21 PWA frontend for the Barbershop MVP.

## Requisitos

- Node.js 22+
- npm 10+

## Instalacion y ejecucion local

```bash
npm install
npm run start
```

La app queda disponible en `http://localhost:4200`.

## Configuracion por entorno

La app carga configuracion en runtime desde archivos en `public/`.

- Desarrollo: `public/config.development.json`
- QA: `public/config.qa.json`
- Produccion: `public/config.production.json`

Campos requeridos en cada archivo:

- `apiBaseUrl`: URL base de API con prefijo `/api/v1`
- `appName`: nombre visible de la aplicacion
- `appUrl`: URL publica de la app
- `assetsBaseUrl`: URL base para recursos estaticos
- `environmentName`: etiqueta de entorno (Development, QA, Production)

Si el archivo runtime falla, la app usa fallback desde `src/environments/`.

## Rutas principales

Publicas:

- `/` landing publica
- `/staff` listado publico de staff
- `/staff/:staffProfileId` perfil publico de staff
- `/staff/:staffProfileId/availability` disponibilidad publica

Autenticacion:

- `/auth/login`
- `/auth/register`

Customer (requiere rol `Customer`):

- `/customer/appointments`
- `/customer/reviews`
- `/booking/confirm`

Staff (requiere rol `Staff`):

- `/staff/profile`
- `/staff/availability`
- `/staff/appointments`

Admin (requiere rol `Admin`):

- `/admin/staff`
- `/admin/appointments`
- `/admin/media`
- `/admin/content/landing`
- `/admin/content/branding`
- `/admin/content/banners`

## Navegacion por rol en shell

- Publico: `Inicio`, `Staff`
- Customer: `Mis citas`, `Mis resenas`
- Staff: `Perfil`, `Disponibilidad`, `Agenda`
- Admin: `Staff`, `Citas`, `Media`, `Landing`, `Branding`, `Banners`

El acceso directo por URL se valida con guards de autenticacion y rol.

## Comandos utiles

Validaciones:

```bash
npm run typecheck
```

Builds por entorno:

```bash
npm run build:dev
npm run build:qa
npm run build:prod
```

Test unitarios:

```bash
npm run test
```

## Script de prueba manual (T057)

1. Publico consulta staff y disponibilidad:

- Abre `/staff` y entra en un perfil.
- Abre `Ver disponibilidad`.
- Cambia el rango y verifica carga, vacio y errores de API.

2. Publico intenta reservar y se redirige a login:

- En disponibilidad, pulsa `Reservar` en un slot.
- Verifica redireccion a `/auth/login` con `returnUrl`.
- Inicia sesion y confirma que vuelve a `/booking/confirm` con `staffProfileId` y `startsAt`.

3. Customer confirma reserva:

- En `/booking/confirm`, confirma la reserva.
- Verifica estado de exito y acceso a `Ver mis citas`.
- Si el slot ya fue tomado, verifica mensaje claro de conflicto.

4. Staff/Admin completa cita:

- Como Staff o Admin, ve a `Agenda` o `Citas`.
- Cambia el estado de la cita a `Completada`.

5. Customer resena cita completada:

- Como Customer, abre `Mis citas`.
- Verifica que solo citas completadas muestran `Dejar resena`.
- Envia resena y confirma que desaparece la accion para esa cita.
- Verifica `Mis resenas` en `/customer/reviews`.
- Verifica resumen/listado de resenas en perfil publico del staff.

## Script de prueba manual (T058)

1. Login como staff:

- Inicia sesion con un usuario que tenga rol `Staff`.
- Verifica acceso a `/staff/profile`, `/staff/availability` y `/staff/appointments`.
- Verifica que usuarios `Customer` o `Admin` no puedan usar esas rutas bajo reglas RBAC actuales.

2. Editar perfil propio:

- En `/staff/profile`, actualiza nombre visible, bio, telefono o duracion base.
- Verifica guardado exitoso y que email/estado/roles sigan en solo lectura.

3. Configurar disponibilidad semanal:

- En `/staff/availability`, activa/desactiva dias y ajusta horarios.
- Verifica que `Guardar reglas` reemplace la configuracion semanal completa.
- Prueba un rango invalido (inicio >= fin) y confirma validacion antes de enviar.

4. Agregar bloqueo temporal:

- Crea un periodo no disponible y valida que aparezca en la lista.
- Edita el periodo y luego eliminalo para confirmar update/delete.
- Verifica que la UI no sugiera cancelacion automatica de citas existentes.

5. Crear cita manual en agenda:

- En `/staff/appointments`, crea una cita manual con datos minimos.
- Verifica que la cita aparezca en la lista con etiquetas de estado/origen.

6. Cambiar estado de cita:

- Marca una cita como `Completada`, `Cancelada` o `No-show`.
- Verifica persistencia del cambio y mensajes claros en conflictos/errores de validacion.

## Script de prueba manual (T059)

1. Login como admin:

- Inicia sesion con rol `Admin`.
- Verifica acceso a `/admin/staff`, `/admin/appointments`, `/admin/media`, `/admin/content/landing`, `/admin/content/branding` y `/admin/content/banners`.

2. Crear y administrar staff:

- En `/admin/staff/new`, crea un staff con `initialPassword` y datos minimos.
- Edita el staff y valida guardado.
- Activa/desactiva desde el listado para comprobar endpoint de estado.

3. Subir media:

- En `/admin/media`, sube un archivo con categoria valida.
- Verifica validaciones cliente (tipo/tamano) y mensaje claro ante error de upload.
- Elimina (archiva) un asset y confirma actualizacion del listado.

4. Actualizar branding:

- En `/admin/content/branding`, cambia nombre y colores.
- Verifica que los colores acepten formato HEX `#RRGGBB`.
- Guarda y confirma feedback de exito.

5. Actualizar landing content:

- En `/admin/content/landing`, modifica hero/about/contact.
- Guarda y valida persistencia.

6. Crear banner:

- En `/admin/content/banners`, crea banner con orden y estado.
- Prueba rango de fechas invalido (fin <= inicio) y valida bloqueo antes de enviar.
- Edita y elimina para validar CRUD completo.

7. Administrar citas:

- En `/admin/appointments`, filtra por staff y crea una cita manual.
- Edita cita y cambia estado a `Completada`, `Cancelada` o `No-show`.
- Verifica mensajes claros en conflictos y validaciones.

8. Verificar impacto publico:

- Revisa la landing publica y confirma aplicacion de branding, contenido y banners activos.
