import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { Permission } from '@fleet-pulse/shared';
import { AuthService } from './auth.service';

// <button *fpCan="'vehicle:write'">Add vehicle</button>
@Directive({ selector: '[fpCan]' })
export class HasPermissionDirective {
  private auth = inject(AuthService);
  private tpl = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);

  fpCan = input.required<Permission>();

  constructor() {
    effect(() => {
      this.vcr.clear();
      if (this.auth.can(this.fpCan())) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}
