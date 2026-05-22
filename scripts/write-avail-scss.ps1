$dest = "d:\Proyects\barbershop\app\front\barbershop-pwa\src\app\features\staff\availability\pages\staff-availability-page\staff-availability-page.component.scss"

$content = @'
/* ═══════════════════════════════════════════════════════
   Staff Availability Page — dark auth theme
═══════════════════════════════════════════════════════ */

.avail-page {
  display: grid;
  gap: 1.5rem;
  max-width: 860px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem);
}

/* ── Header ──────────────────────────────────────────── */

.avail-page__header {
  text-align: center;

  h1 {
    margin: 0.25rem 0 0.5rem;
    font-size: clamp(1.5rem, 3vw, 2rem);
    color: var(--color-text);
  }
}

.avail-page__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-secondary, #b08a4a);
}

.avail-page__subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
}

/* ── Stats strip ─────────────────────────────────────── */

.avail-page__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.avail-page__stat {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--border-soft, rgba(110, 96, 74, 0.35));
  border-radius: 1rem;
  background: rgba(22, 24, 23, 0.55);

  span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
  }

  strong {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-secondary, #b08a4a);
  }
}

/* ── Tabs ────────────────────────────────────────────── */

.avail-page__tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-soft, rgba(110, 96, 74, 0.3));
  padding-bottom: 0;
}

.avail-page__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  margin-bottom: -1px;

  &:hover {
    color: var(--color-text);
  }

  &--active {
    color: var(--color-secondary, #b08a4a);
    border-bottom-color: var(--color-secondary, #b08a4a);
    font-weight: 600;
  }
}

.avail-page__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--color-secondary, #b08a4a);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
}

/* ── Panel container ─────────────────────────────────── */

.avail-page__panel {
  display: grid;
  gap: 1.25rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid var(--border-soft, rgba(110, 96, 74, 0.35));
  border-radius: 1.25rem;
  background: rgba(22, 24, 23, 0.5);
}

/* ── Fieldset reset ──────────────────────────────────── */

fieldset {
  margin: 0;
  padding: 0;
  border: none;
  display: grid;
  gap: 0.85rem;

  &:disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

/* ── Day list ────────────────────────────────────────── */

.avail-page__day-list {
  display: grid;
  gap: 0.75rem;
}

.avail-page__day-card {
  border: 1px solid var(--border-soft, rgba(110, 96, 74, 0.3));
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  background: rgba(22, 24, 23, 0.6);
  display: grid;
  gap: 0.75rem;
  transition: border-color 0.2s, background 0.2s;

  &--inactive {
    background: rgba(22, 24, 23, 0.3);
    border-color: rgba(110, 96, 74, 0.15);
  }
}

.avail-page__day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.avail-page__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;

  input[type='checkbox'] {
    appearance: none;
    width: 2.5rem;
    height: 1.4rem;
    border-radius: 999px;
    border: 1px solid rgba(110, 96, 74, 0.5);
    background: rgba(22, 24, 23, 0.8);
    position: relative;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 3px;
      transform: translateY(-50%);
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      background: rgba(110, 96, 74, 0.6);
      transition: left 0.2s, background 0.2s;
    }

    &:checked {
      background: rgba(176, 138, 74, 0.25);
      border-color: var(--color-secondary, #b08a4a);

      &::after {
        left: calc(100% - 1rem - 3px);
        background: var(--color-secondary, #b08a4a);
      }
    }
  }
}

.avail-page__toggle-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.avail-page__day-status {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* ── Time blocks ─────────────────────────────────────── */

.avail-page__blocks {
  display: grid;
  gap: 0.5rem;
}

.avail-page__block {
  display: grid;
  gap: 0.35rem;
}

.avail-page__block-fields {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.6rem;
  align-items: end;
}

.avail-page__btn-remove-block {
  width: 2rem;
  height: 2.4rem;
  border: 1px solid rgba(180, 83, 60, 0.4);
  border-radius: 0.5rem;
  background: rgba(180, 83, 60, 0.08);
  color: var(--color-error, #b4533c);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;

  &:hover:not(:disabled) {
    background: rgba(180, 83, 60, 0.2);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.avail-page__btn-add-block {
  align-self: start;
  padding: 0.35rem 0.85rem;
  border: 1px dashed rgba(176, 138, 74, 0.45);
  border-radius: 0.65rem;
  background: transparent;
  color: var(--color-secondary, #b08a4a);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  width: fit-content;

  &:hover:not(:disabled) {
    background: rgba(176, 138, 74, 0.08);
    border-color: rgba(176, 138, 74, 0.7);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ── Fields ──────────────────────────────────────────── */

.avail-page__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.6rem 0.85rem;
    border: 1px solid rgba(110, 96, 74, 0.55);
    border-radius: 0.75rem;
    background: rgba(22, 24, 23, 0.74);
    color: var(--color-text);
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:focus {
      border-color: rgba(176, 138, 74, 0.7);
      box-shadow: 0 0 0 3px rgba(176, 138, 74, 0.12);
    }

    &::-webkit-calendar-picker-indicator {
      filter: invert(0.7) sepia(1) saturate(2) hue-rotate(5deg);
      cursor: pointer;
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }
}

.avail-page__required {
  color: var(--color-error, #b4533c);
}

.avail-page__error {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-error, #b4533c);
}

/* ── Form actions ────────────────────────────────────── */

.avail-page__form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

/* ── Absences tab ────────────────────────────────────── */

.avail-page__absences-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  h2 {
    margin: 0.1rem 0 0;
    font-size: 1.1rem;
    color: var(--color-text);
  }
}

.avail-page__section-label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-secondary, #b08a4a);
}

/* ── Table ───────────────────────────────────────────── */

.avail-page__table-wrap {
  overflow-x: auto;
  border-radius: 0.75rem;
  border: 1px solid rgba(110, 96, 74, 0.25);
}

.avail-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  thead {
    background: rgba(22, 24, 23, 0.6);

    th {
      padding: 0.7rem 1rem;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      white-space: nowrap;
    }
  }

  tbody {
    tr {
      border-top: 1px solid rgba(110, 96, 74, 0.18);
      transition: background 0.15s;

      &:hover {
        background: rgba(176, 138, 74, 0.04);
      }
    }

    td {
      padding: 0.8rem 1rem;
      color: var(--color-text);
      vertical-align: middle;
    }
  }
}

.avail-page__table-reason {
  color: var(--color-text-secondary) !important;
  font-style: italic;
}

.avail-page__table-created {
  color: var(--color-text-muted) !important;
  font-size: 0.8rem !important;
  white-space: nowrap;
}

.avail-page__table-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  white-space: nowrap;
}

/* ── Buttons ─────────────────────────────────────────── */

.avail-page__submit {
  padding: 0.65rem 1.5rem;
  border: none;
  border-radius: 0.85rem;
  background: var(--color-secondary, #b08a4a);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: var(--color-secondary-hover, #c9a060);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.avail-page__btn-secondary {
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(176, 138, 74, 0.5);
  border-radius: 0.65rem;
  background: rgba(176, 138, 74, 0.08);
  color: var(--color-secondary, #b08a4a);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(176, 138, 74, 0.18);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.avail-page__btn-danger {
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(180, 83, 60, 0.45);
  border-radius: 0.65rem;
  background: rgba(180, 83, 60, 0.07);
  color: var(--color-error, #b4533c);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(180, 83, 60, 0.17);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.avail-page__btn-ghost {
  padding: 0.65rem 1.25rem;
  border: 1px solid rgba(110, 96, 74, 0.4);
  border-radius: 0.85rem;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(110, 96, 74, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ═══════════════════════════════════════════════════════
   Modal
═══════════════════════════════════════════════════════ */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(10, 11, 10, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 540px;
  max-height: 90dvh;
  overflow-y: auto;
  background: #1a1c1a;
  border: 1px solid rgba(110, 96, 74, 0.45);
  border-radius: 1.5rem;
  padding: 1.5rem;
  display: grid;
  gap: 1.25rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text);
  }
}

.modal__close {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  background: rgba(110, 96, 74, 0.15);
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(110, 96, 74, 0.3);
  }
}

.modal__form {
  display: grid;
  gap: 1rem;
}

.modal__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.modal__field--wide {
  grid-column: 1 / -1;
}

.modal__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-top: 0.25rem;
}

/* ── Responsive ──────────────────────────────────────── */

@media (max-width: 600px) {
  .avail-page__block-fields {
    grid-template-columns: 1fr 1fr;
  }

  .avail-page__btn-remove-block {
    grid-column: 2;
    justify-self: end;
  }

  .modal__grid {
    grid-template-columns: 1fr;
  }

  .avail-page__table {
    font-size: 0.8rem;

    th,
    td {
      padding: 0.6rem 0.7rem;
    }
  }
}
'@

[System.IO.File]::WriteAllText($dest, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "SCSS written OK"
