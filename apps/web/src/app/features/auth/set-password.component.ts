import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api';

@Component({
  selector: 'fp-set-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <h1>Set your password</h1>
        @if (complete()) {
          <p>Your password is ready. You can now sign in.</p>
          <a class="btn primary" routerLink="/login">Go to sign in</a>
        } @else if (!token) {
          <p>This password setup link is invalid or has expired. Ask your administrator for a new invitation.</p>
          <a routerLink="/login">Back to sign in</a>
        } @else {
          <p>Choose a password for your Fleet-Pulse account.</p>
          @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label for="new-password">New password</label>
              <input id="new-password" class="input" type="password" formControlName="password" autocomplete="new-password" />
              <span class="hint">At least 12 characters with upper case, lower case and a number.</span>
            </div>
            <div class="field">
              <label for="confirm-password">Confirm password</label>
              <input id="confirm-password" class="input" type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (form.errors?.['passwordMismatch'] && form.controls.confirmPassword.touched) {
                <span class="err">Passwords do not match.</span>
              }
            </div>
            <button class="btn primary" style="width: 100%" [disabled]="form.invalid || busy()">
              {{ busy() ? 'Saving…' : 'Set password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class SetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  busy = signal(false);
  complete = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group(
    {
      password: ['', [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
        Validators.pattern(/[a-z]/),
        Validators.pattern(/[A-Z]/),
        Validators.pattern(/\d/),
      ]],
      confirmPassword: ['', Validators.required],
    },
    { validators: SetPasswordComponent.passwordsMatch },
  );

  private static passwordsMatch(control: AbstractControl): ValidationErrors | null {
    return control.get('password')?.value === control.get('confirmPassword')?.value
      ? null
      : { passwordMismatch: true };
  }

  submit() {
    if (!this.token || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.http
      .post('/api/auth/set-password', {
        token: this.token,
        password: this.form.controls.password.value,
      })
      .subscribe({
        next: () => {
          this.complete.set(true);
          this.busy.set(false);
        },
        error: (e) => {
          this.error.set(errorMessage(e, 'Could not set your password.'));
          this.busy.set(false);
        },
      });
  }
}
