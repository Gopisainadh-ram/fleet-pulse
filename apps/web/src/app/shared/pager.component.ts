import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'fp-pager',
  template: `
    <div class="pager">
      <span>{{ from() }}–{{ to() }} of {{ total() }}</span>
      <div class="btns">
        <button class="btn sm" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">Previous</button>
        <span>Page {{ page() }} of {{ totalPages() }}</span>
        <button class="btn sm" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)">Next</button>
      </div>
    </div>
  `,
})
export class PagerComponent {
  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();
  totalPages = input.required<number>();
  pageChange = output<number>();

  from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
}
