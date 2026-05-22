$dest = "d:\Proyects\barbershop\app\front\barbershop-pwa\src\app\features\staff\availability\pages\staff-availability-page\staff-availability-page.component.html"

$content = @'
<section class="avail-page">
  <div class="avail-page__header">
    <p class="avail-page__eyebrow">Mi cuenta</p>
    <h1>Mi disponibilidad</h1>
    <p class="avail-page__subtitle">Configura tus horarios semanales y gestiona tus ausentismos.</p>
  </div>

  <app-api-feedback severity="error" [message]="pageErrorMessage()" />

  @if (isLoading()) {
    <app-page-state kind="loading" message="Cargando disponibilidad..." />
  } @else if (!summary()) {
    <app-page-state kind="empty" message="No se pudo cargar tu disponibilidad." />
  } @else {

    <!-- Stats strip -->
    <div class="avail-page__stats">
      <div class="avail-page__stat">
        <span>Duracion de cita</span>
        <strong>{{ summary()?.defaultAppointmentDurationMinutes }} min</strong>
      </div>
      <div class="avail-page__stat">
        <span>Dias activos</span>
        <strong>{{ getActiveDaysCount() }}</strong>
      </div>
      <div class="avail-page__stat">
        <span>Ausentismos registrados</span>
        <strong>{{ unavailablePeriods().length }}</strong>
      </div>
    </div>

    <!-- Tabs -->
    <div class="avail-page__tabs" role="tablist">
      <button
        class="avail-page__tab"
        role="tab"
        type="button"
        [class.avail-page__tab--active]="activeTab() === 'availability'"
        (click)="activeTab.set('availability')"
      >
        Disponibilidad
      </button>
      <button
        class="avail-page__tab"
        role="tab"
        type="button"
        [class.avail-page__tab--active]="activeTab() === 'absences'"
        (click)="activeTab.set('absences')"
      >
        Ausentismos
        @if (recentAbsences().length > 0) {
          <span class="avail-page__tab-badge">{{ recentAbsences().length }}</span>
        }
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════
         TAB: Disponibilidad
    ═══════════════════════════════════════════════════════════════ -->
    @if (activeTab() === 'availability') {
      <div class="avail-page__panel">
        @if (durationWarning()) {
          <app-api-feedback severity="info" [message]="durationWarning()" />
        }
        <app-api-feedback severity="error" [message]="rulesErrorMessage()" />
        <app-api-feedback severity="info" [message]="rulesSuccessMessage()" />

        <form [formGroup]="daysForm" (ngSubmit)="saveRules()" novalidate>
          <fieldset [disabled]="isRulesBusy()">
            <div class="avail-page__day-list" formArrayName="days">
              @for (
                dayGroup of daysArray.controls;
                track dayOptions[$index].dayOfWeek;
                let di = $index
              ) {
                <div
                  class="avail-page__day-card"
                  [class.avail-page__day-card--inactive]="!dayGroup.controls.isActive.value"
                  [formGroupName]="di"
                >
                  <!-- Day header: toggle + label -->
                  <div class="avail-page__day-header">
                    <label class="avail-page__toggle" [for]="'day-active-' + di">
                      <input
                        [id]="'day-active-' + di"
                        type="checkbox"
                        formControlName="isActive"
                      />
                      <span class="avail-page__toggle-label">{{ dayOptions[di].label }}</span>
                    </label>
                    <span class="avail-page__day-status">
                      {{ dayGroup.controls.isActive.value ? 'Disponible' : 'Sin atencion' }}
                    </span>
                  </div>

                  <!-- Time blocks -->
                  @if (dayGroup.controls.isActive.value) {
                    <div class="avail-page__blocks" formArrayName="blocks">
                      @for (
                        blockGroup of blocksOf(di).controls;
                        track $index;
                        let bi = $index
                      ) {
                        <div class="avail-page__block" [formGroupName]="bi">
                          <div class="avail-page__block-fields">
                            <div class="avail-page__field">
                              <label [for]="'start-' + di + '-' + bi">Desde</label>
                              <input
                                [id]="'start-' + di + '-' + bi"
                                type="time"
                                formControlName="startTime"
                              />
                            </div>
                            <div class="avail-page__field">
                              <label [for]="'end-' + di + '-' + bi">Hasta</label>
                              <input
                                [id]="'end-' + di + '-' + bi"
                                type="time"
                                formControlName="endTime"
                              />
                            </div>
                            @if (blocksOf(di).length > 1) {
                              <button
                                class="avail-page__btn-remove-block"
                                type="button"
                                [disabled]="isRulesBusy()"
                                (click)="removeBlock(di, bi)"
                                title="Eliminar bloque"
                              >
                                &times;
                              </button>
                            }
                          </div>

                          @if (showBlockError(di, bi, 'requiredTime')) {
                            <p class="avail-page__error">Completa la hora de inicio y fin.</p>
                          }
                          @if (showBlockError(di, bi, 'timeRange')) {
                            <p class="avail-page__error">La hora de inicio debe ser anterior a la hora de fin.</p>
                          }
                        </div>
                      }
                    </div>

                    <button
                      class="avail-page__btn-add-block"
                      type="button"
                      [disabled]="isRulesBusy()"
                      (click)="addBlock(di)"
                    >
                      + Agregar bloque horario
                    </button>
                  }
                </div>
              }
            </div>
          </fieldset>

          <div class="avail-page__form-actions">
            <button
              class="avail-page__submit"
              type="submit"
              [disabled]="isRulesBusy() || hasRulesErrors()"
            >
              {{ rulesSubmitLabel() }}
            </button>
          </div>
        </form>
      </div>
    }

    <!-- ═══════════════════════════════════════════════════════════════
         TAB: Ausentismos
    ═══════════════════════════════════════════════════════════════ -->
    @if (activeTab() === 'absences') {
      <div class="avail-page__panel">
        <div class="avail-page__absences-header">
          <div>
            <p class="avail-page__section-label">Ultimos 60 dias</p>
            <h2>Ausentismos</h2>
          </div>
          <button
            class="avail-page__submit"
            type="button"
            [disabled]="isAbsenceBusy()"
            (click)="openAbsenceModal()"
          >
            Nuevo ausentismo
          </button>
        </div>

        <app-api-feedback severity="error" [message]="absenceErrorMessage()" />

        @if (recentAbsences().length === 0) {
          <div class="avail-page__empty">
            No hay ausentismos registrados en los ultimos 60 dias.
          </div>
        } @else {
          <div class="avail-page__table-wrap">
            <table class="avail-page__table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Motivo</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (period of recentAbsences(); track period.id) {
                  <tr [class.avail-page__row--past]="isAbsencePast(period)">
                    <td>{{ formatPeriodWindow(period) }}</td>
                    <td class="avail-page__table-reason">{{ period.reason || '—' }}</td>
                    <td class="avail-page__table-created">{{ formatTimestamp(period.createdAtUtc) }}</td>
                    <td class="avail-page__table-actions">
                      <button
                        class="avail-page__btn-secondary"
                        type="button"
                        [disabled]="isAbsenceBusy() || isAbsencePast(period)"
                        [title]="isAbsencePast(period) ? 'No se puede editar un ausentismo que ya inicio' : 'Editar'"
                        (click)="openAbsenceModal(period)"
                      >
                        Editar
                      </button>
                      <button
                        class="avail-page__btn-danger"
                        type="button"
                        [disabled]="isAbsenceBusy() || isAbsencePast(period)"
                        [title]="isAbsencePast(period) ? 'No se puede eliminar un ausentismo que ya inicio' : 'Eliminar'"
                        (click)="deleteAbsence(period)"
                      >
                        {{ deletingAbsenceId() === period.id ? 'Eliminando...' : 'Eliminar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="avail-page__table-hint">Los ausentismos ya iniciados no pueden editarse ni eliminarse.</p>
        }
      </div>
    }

  }
</section>

<!-- ═══════════════════════════════════════════════════════════════════════
     MODAL: Crear / Editar ausentismo
═══════════════════════════════════════════════════════════════════════ -->
@if (showAbsenceModal()) {
  <div class="modal-overlay" (click)="closeAbsenceModal()" role="dialog" aria-modal="true">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal__header">
        <h2>{{ editingAbsenceId() ? 'Editar ausentismo' : 'Nuevo ausentismo' }}</h2>
        <button class="modal__close" type="button" (click)="closeAbsenceModal()" aria-label="Cerrar">
          &times;
        </button>
      </div>

      <app-api-feedback severity="error" [message]="absenceErrorMessage()" />

      <form class="modal__form" [formGroup]="absenceForm" (ngSubmit)="submitAbsence()" novalidate>
        <fieldset [disabled]="isSavingAbsence()">

          <!-- All-day toggle -->
          <div class="modal__allday">
            <label class="avail-page__toggle" for="modal-isAllDay">
              <input
                id="modal-isAllDay"
                type="checkbox"
                formControlName="isAllDay"
                (change)="onAllDayChange()"
              />
              <span class="avail-page__toggle-label">Dia completo</span>
            </label>
            <span class="modal__allday-hint">
              {{ absenceForm.controls.isAllDay.value
                  ? 'Selecciona solo dias — el ausentismo cubre todo el dia'
                  : 'Selecciona fecha y hora exactas' }}
            </span>
          </div>

          <!-- Date / datetime inputs -->
          <div class="modal__grid">
            @if (absenceForm.controls.isAllDay.value) {
              <div class="avail-page__field">
                <label for="modal-startValue">
                  Desde el dia <span class="avail-page__required">*</span>
                </label>
                <input
                  id="modal-startValue"
                  type="date"
                  formControlName="startValue"
                  [min]="minStartDate"
                />
                @if (showAbsenceControlError('startValue', 'required')) {
                  <p class="avail-page__error">La fecha de inicio es obligatoria.</p>
                }
              </div>
              <div class="avail-page__field">
                <label for="modal-endValue">
                  Hasta el dia <span class="avail-page__required">*</span>
                </label>
                <input
                  id="modal-endValue"
                  type="date"
                  formControlName="endValue"
                  [min]="minStartDate"
                />
                @if (showAbsenceControlError('endValue', 'required')) {
                  <p class="avail-page__error">La fecha de fin es obligatoria.</p>
                }
              </div>
            } @else {
              <div class="avail-page__field">
                <label for="modal-startValue">
                  Fecha y hora de inicio <span class="avail-page__required">*</span>
                </label>
                <input
                  id="modal-startValue"
                  type="datetime-local"
                  formControlName="startValue"
                  [min]="minStartDatetime"
                />
                @if (showAbsenceControlError('startValue', 'required')) {
                  <p class="avail-page__error">La fecha de inicio es obligatoria.</p>
                }
              </div>
              <div class="avail-page__field">
                <label for="modal-endValue">
                  Fecha y hora de fin <span class="avail-page__required">*</span>
                </label>
                <input
                  id="modal-endValue"
                  type="datetime-local"
                  formControlName="endValue"
                  [min]="minStartDatetime"
                />
                @if (showAbsenceControlError('endValue', 'required')) {
                  <p class="avail-page__error">La fecha de fin es obligatoria.</p>
                }
              </div>
            }

            <div class="avail-page__field modal__field--wide">
              <label for="modal-reason">Motivo</label>
              <textarea
                id="modal-reason"
                rows="3"
                formControlName="reason"
                placeholder="Opcional — vacaciones, cita medica, etc."
              ></textarea>
              @if (showAbsenceControlError('reason', 'maxlength')) {
                <p class="avail-page__error">El motivo debe tener 500 caracteres o menos.</p>
              }
            </div>
          </div>

          @if (showAbsenceGroupError('pastStart')) {
            <p class="avail-page__error">
              La fecha de inicio debe ser a partir de manana — no se permiten ausentismos del dia actual hacia atras.
            </p>
          }
          @if (showAbsenceGroupError('timeRange')) {
            <p class="avail-page__error">La fecha de inicio debe ser anterior a la fecha de fin.</p>
          }
        </fieldset>

        <div class="modal__actions">
          <button
            class="avail-page__btn-ghost"
            type="button"
            [disabled]="isSavingAbsence()"
            (click)="closeAbsenceModal()"
          >
            Cancelar
          </button>
          <button
            class="avail-page__submit"
            type="submit"
            [disabled]="isSavingAbsence() || absenceForm.invalid"
          >
            {{ absenceSubmitLabel() }}
          </button>
        </div>
      </form>
    </div>
  </div>
}
'@

[System.IO.File]::WriteAllText($dest, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "HTML written OK"
