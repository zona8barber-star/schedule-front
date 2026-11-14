import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * SONDA BUG-044: a link to a record that does not exist (wrong or old id, deactivated professional) shows this
 * Spanish state with a way back, never the server's text.
 */
@Component({
  selector: 'app-not-found-state',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="not-found-state" role="status" data-testid="not-found-state">
      <h2 class="not-found-state__title">{{ title() }}</h2>
      <p class="not-found-state__message">{{ message() }}</p>
      <a class="not-found-state__back" [routerLink]="backLink()" data-testid="not-found-back">{{ backLabel() }}</a>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .not-found-state {
      display: grid;
      justify-items: center;
      gap: 0.6rem;
      max-width: 32rem;
      margin: 1.5rem auto;
      padding: 1.5rem 1.25rem;
      border: 1px solid var(--color-border, rgba(176, 138, 74, 0.35));
      border-radius: 12px;
      background: var(--color-surface, transparent);
      color: var(--color-text);
      text-align: center;
    }

    .not-found-state__title {
      margin: 0;
      font-size: 1.1rem;
    }

    .not-found-state__message {
      margin: 0;
      color: var(--color-text-secondary);
      font-size: 0.92rem;
      line-height: 1.55;
    }

    .not-found-state__back {
      margin-top: 0.4rem;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0.6rem 1.4rem;
      border-radius: 999px;
      background: var(--z-brass-dk, #8f6f38);
      color: #fff;
      font-weight: 600;
      text-decoration: none;
    }

    .not-found-state__back:focus-visible {
      outline: 2px solid var(--color-text);
      outline-offset: 2px;
    }
  `,
})
export class NotFoundStateComponent {
  readonly title = input.required<string>();
  readonly message = input('Es posible que el enlace esté mal escrito o que ya no exista.');
  readonly backLink = input.required<string>();
  readonly backLabel = input.required<string>();
}
