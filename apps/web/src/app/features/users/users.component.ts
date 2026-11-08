import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, merge, Observable } from 'rxjs';
import { canManageRole, Paginated, ROLES, UserDto } from '@fleet-pulse/shared';
import { errorMessage, toParams } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { BadgeComponent } from '../../shared/badge.component';
import { ModalComponent } from '../../shared/modal.component';
import { PagerComponent } from '../../shared/pager.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'fp-users',
  imports: [ReactiveFormsModule, DatePipe, ModalComponent, PagerComponent, BadgeComponent],
  template: `
    <div class="page-head">
      <div>
        <h1>Users</h1>
        <p>People who can sign in. Deactivate an account instead of deleting it.</p>
      </div>
      <button class="btn primary" (click)="openForm()">Add user</button>
    </div>

    @if (invitationNotice(); as notice) {
      <div class="alert" [class.info]="notice.link" role="status">
        {{ notice.message }}
        @if (notice.link) {
          <div><a [href]="notice.link">{{ notice.link }}</a></div>
        }
      </div>
    }

    <div class="toolbar">
      <input class="input grow" type="search" placeholder="Search name or email" [formControl]="search" aria-label="Search users" />
      <select class="input" [formControl]="role" aria-label="Filter by role">
        <option value="">Any role</option>
        @for (r of roles; track r) { <option [value]="r">{{ label(r) }}</option> }
      </select>
    </div>

    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    <div class="panel">
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (u of items(); track u.id) {
              <tr>
                <td data-label="Name"><strong>{{ u.firstName }} {{ u.lastName }}</strong></td>
                <td data-label="Email">{{ u.email }}</td>
                <td data-label="Role"><fp-badge [value]="u.role" /></td>
                <td data-label="Status">
                  {{ u.isActive ? 'Active' : 'Deactivated' }}
                  <div class="sub">{{ u.setupComplete ? 'Password set' : 'Invitation pending' }}</div>
                </td>
                <td data-label="Created">{{ u.createdAt | date: 'dd MMM yyyy' }}</td>
                <td class="actions-cell">
                  <div class="actions">
                    @if (!u.setupComplete && canEdit(u)) {
                      <button class="btn sm" [disabled]="resending() === u.id" (click)="resendInvitation(u)">
                        {{ resending() === u.id ? 'Sending…' : 'Resend invite' }}
                      </button>
                    }
                    <button class="btn sm" [disabled]="!canEdit(u)" (click)="openForm(u)">Edit</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6"><div class="empty">{{ loading() ? 'Loading…' : 'No users found.' }}</div></td></tr>
            }
          </tbody>
        </table>
      </div>
      <fp-pager [page]="page()" [pageSize]="pageSize" [total]="total()" [totalPages]="totalPages()" (pageChange)="goTo($event)" />
    </div>

    @if (formOpen()) {
      <fp-modal [title]="editing() ? 'Edit user' : 'Add user'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            @if (formError()) { <div class="alert error" role="alert">{{ formError() }}</div> }
            <div class="form-grid">
              <div class="field"><label for="u-first">First name</label><input id="u-first" class="input" formControlName="firstName" /></div>
              <div class="field"><label for="u-last">Last name</label><input id="u-last" class="input" formControlName="lastName" /></div>
            </div>
            @if (!editing()) {
              <div class="field"><label for="u-email">Email</label><input id="u-email" class="input" type="email" formControlName="email" /></div>
              <p class="sub">We’ll email a one-time link so the user can set their own password.</p>
            } @else {
              <div class="field">
                <label for="u-pass">New password (leave empty to keep the current one)</label>
                <input id="u-pass" class="input" type="password" formControlName="password" autocomplete="new-password" />
                <span class="hint">At least 12 characters with upper case, lower case and a number.</span>
              </div>
            }
            <div class="form-grid">
              <div class="field">
                <label for="u-role">Role</label>
                <select id="u-role" class="input" formControlName="role">
                  @for (r of assignableRoles(); track r) { <option [value]="r">{{ label(r) }}</option> }
                </select>
              </div>
              @if (editing()) {
                <div class="field">
                  <label for="u-active">Account</label>
                  <select id="u-active" class="input" formControlName="isActive">
                    <option [ngValue]="true">Active</option>
                    <option [ngValue]="false">Deactivated</option>
                  </select>
                </div>
              }
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="formOpen.set(false)">Cancel</button>
            <button class="btn primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save user' }}</button>
          </div>
        </form>
      </fp-modal>
    }
  `,
})
export class UsersComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly pageSize = PAGE_SIZE;
  readonly roles = ROLES;
  // Only offer roles the signed-in user is actually allowed to hand out
  assignableRoles = computed(() => ROLES.filter((r) => canManageRole(this.auth.user()!.role, r)));

  items = signal<UserDto[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(false);
  error = signal('');

  search = new FormControl('', { nonNullable: true });
  role = new FormControl('', { nonNullable: true });

  formOpen = signal(false);
  editing = signal<UserDto | null>(null);
  saving = signal(false);
  formError = signal('');
  resending = signal('');
  invitationNotice = signal<{ message: string; link: string | null } | null>(null);

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(12)]],
    role: ['VIEWER'],
    isActive: [true],
  });

  constructor() {
    merge(this.search.valueChanges.pipe(debounceTime(300)), this.role.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.goTo(1));
    this.load();
  }

  label(v: string) {
    const t = v.toLowerCase().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  canEdit(u: UserDto) {
    const me = this.auth.user()!;
    return u.id !== me.id && canManageRole(me.role, u.role);
  }

  goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.http
      .get<Paginated<UserDto>>('/api/users', {
        params: toParams({ page: this.page(), pageSize: PAGE_SIZE, search: this.search.value, role: this.role.value }),
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.items);
          this.total.set(r.total);
          this.totalPages.set(r.totalPages);
          this.error.set('');
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(errorMessage(e));
          this.loading.set(false);
        },
      });
  }

  openForm(u?: UserDto) {
    this.editing.set(u ?? null);
    this.formError.set('');
    this.form.reset({
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
      email: u?.email ?? 'placeholder@example.com',
      password: '',
      role: u?.role ?? this.assignableRoles()[this.assignableRoles().length - 1],
      isActive: u?.isActive ?? true,
    });
    // Password changes are optional when editing an existing account.
    this.form.controls.password.setValidators(u ? [Validators.minLength(12)] : []);
    if (!u) this.form.controls.email.reset('');
    this.form.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const current = this.editing();

    const request: Observable<UserDto | { invitationSent: boolean; invitationLink: string | null }> = current
      ? this.http.patch<UserDto>(`/api/users/${current.id}`, {
          firstName: v.firstName,
          lastName: v.lastName,
          role: v.role,
          isActive: v.isActive,
          ...(v.password ? { password: v.password } : {}),
        })
      : this.http.post<{ invitationSent: boolean; invitationLink: string | null }>('/api/users', {
          email: v.email,
          firstName: v.firstName,
          lastName: v.lastName,
          role: v.role,
        });

    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if ('invitationSent' in result) {
          this.invitationNotice.set({
            message: result.invitationSent
              ? `Invitation email sent to ${v.email}.`
              : `Email could not be sent. Share this one-time setup link with ${v.email}.`,
            link: result.invitationLink,
          });
        }
        this.load();
      },
      error: (e) => {
        this.formError.set(errorMessage(e));
        this.saving.set(false);
      },
    });
  }

  resendInvitation(user: UserDto) {
    this.resending.set(user.id);
    this.invitationNotice.set(null);
    this.http
      .post<{ invitationSent: boolean; invitationLink: string | null }>(`/api/users/${user.id}/invitation`, {})
      .subscribe({
        next: (invite) => {
          this.resending.set('');
          this.invitationNotice.set({
            message: invite.invitationSent
              ? `Invitation email sent to ${user.email}.`
              : `Email could not be sent. Share this one-time setup link with ${user.email}.`,
            link: invite.invitationLink,
          });
          this.load();
        },
        error: (e) => {
          this.error.set(errorMessage(e));
          this.resending.set('');
        },
      });
  }
}
