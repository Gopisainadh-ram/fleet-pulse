import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'fp-modal',
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>{{ title() }}</h2>
          <button type="button" class="icon-btn" aria-label="Close" (click)="closed.emit()">&times;</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  title = input.required<string>();
  closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}
