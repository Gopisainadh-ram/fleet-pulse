import { Component, computed, input } from '@angular/core';

const TONE: Record<string, string> = {
  AVAILABLE: 'ok', IN_USE: 'info', MAINTENANCE: 'warn', RETIRED: '',
  ACTIVE: 'ok', ON_LEAVE: 'warn', SUSPENDED: 'bad',
  SUPER_ADMIN: 'bad', ADMIN: 'warn', MANAGER: 'info', DRIVER: 'ok', VIEWER: '',
};

@Component({
  selector: 'fp-badge',
  template: `<span class="badge" [class]="'badge ' + tone()">{{ label() }}</span>`,
})
export class BadgeComponent {
  value = input.required<string>();
  tone = computed(() => TONE[this.value()] ?? '');
  // "IN_USE" -> "In use"
  label = computed(() => {
    const t = this.value().toLowerCase().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
}
