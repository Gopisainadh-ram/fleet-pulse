import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fp-forbidden',
  imports: [RouterLink],
  template: `
    <div class="page-head">
      <div>
        <h1>No access</h1>
        <p>Your role can't open this page. If you think that's a mistake, ask an admin.</p>
      </div>
    </div>
    <a class="btn" routerLink="/">Back to start</a>
  `,
})
export class ForbiddenComponent {}
