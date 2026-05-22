import { Component, HostListener, inject } from '@angular/core';

import { ConfirmModalService } from '../../../core/services/confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  imports: [],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.scss',
  host: { style: 'display:contents' },
})
export class ConfirmModalComponent {
  readonly service = inject(ConfirmModalService);

  get state() {
    return this.service.state();
  }

  confirm(): void {
    this.service._resolve(true);
  }

  cancel(): void {
    this.service._resolve(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state) {
      this.service._resolve(false);
    }
  }
}
