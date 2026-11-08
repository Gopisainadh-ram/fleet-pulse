import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, merge } from 'rxjs';
import { DRIVER_STATUSES, DriverDto } from '@fleet-pulse/shared';
import { errorMessage } from '../../core/api';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { BadgeComponent } from '../../shared/badge.component';
import { ModalComponent } from '../../shared/modal.component';
import { PagerComponent } from '../../shared/pager.component';
import { DriverService } from './driver.service';

const PAGE_SIZE = 10;

@Component({
  selector: 'fp-drivers',
  imports: [ReactiveFormsModule, DatePipe, HasPermissionDirective, ModalComponent, PagerComponent, BadgeComponent],
  template: `
    <div class="page-head">
      <div>
        <h1>Drivers</h1>
        <p>{{ total() }} on the roster</p>
      </div>
      <button *fpCan="'driver:write'" class="btn primary" (click)="openForm()">Add driver</button>
    </div>

    <div class="toolbar">
      <input class="input grow" type="search" placeholder="Search name, email or licence number" [formControl]="search" aria-label="Search drivers" />
      <select class="input" [formControl]="status" aria-label="Filter by status">
        <option value="">Any status</option>
        @for (s of statuses; track s) { <option [value]="s">{{ label(s) }}</option> }
      </select>
      <select class="input" [formControl]="hasVehicle" aria-label="Filter by vehicle">
        <option value="">With or without vehicle</option>
        <option value="true">Has a vehicle</option>
        <option value="false">No vehicle</option>
      </select>
      <label class="check"><input type="checkbox" [formControl]="expiring" /> Licence expiring in 30 days</label>
    </div>

    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    <div class="panel">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th><button (click)="sortBy('lastName')">Name{{ arrow('lastName') }}</button></th>
              <th>Contact</th>
              <th>Licence</th>
              <th><button (click)="sortBy('licenseExpiry')">Expires{{ arrow('licenseExpiry') }}</button></th>
              <th>Status</th>
              <th>Vehicle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of items(); track d.id) {
              <tr>
                <td data-label="Name"><strong>{{ d.firstName }} {{ d.lastName }}</strong></td>
                <td data-label="Contact">{{ d.email }}<br /><span class="sub">{{ d.phone || '' }}</span></td>
                <td data-label="Licence">{{ d.licenseNumber }} <span class="sub">{{ d.licenseClass }}</span></td>
                <td data-label="Expires">
                  {{ d.licenseExpiry | date: 'dd MMM yyyy' }}
                  @if (isExpired(d)) { <span class="badge bad">Expired</span> }
                </td>
                <td data-label="Status"><fp-badge [value]="d.status" /></td>
                <td data-label="Vehicle">{{ d.currentVehicle ? d.currentVehicle.plateNumber : '—' }}</td>
                <td class="actions-cell">
                  <div class="actions">
                    <button *fpCan="'driver:write'" class="btn sm" (click)="openForm(d)">Edit</button>
                    <button *fpCan="'driver:delete'" class="btn sm danger" (click)="remove(d)">Delete</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7"><div class="empty">{{ loading() ? 'Loading…' : 'No drivers match those filters.' }}</div></td></tr>
            }
          </tbody>
        </table>
      </div>
      <fp-pager [page]="page()" [pageSize]="pageSize" [total]="total()" [totalPages]="totalPages()" (pageChange)="goTo($event)" />
    </div>

    @if (formOpen()) {
      <fp-modal [title]="editing() ? 'Edit driver' : 'Add driver'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            @if (formError()) { <div class="alert error" role="alert">{{ formError() }}</div> }
            <div class="form-grid">
              <div class="field"><label for="d-first">First name</label><input id="d-first" class="input" formControlName="firstName" /></div>
              <div class="field"><label for="d-last">Last name</label><input id="d-last" class="input" formControlName="lastName" /></div>
              <div class="field">
                <label for="d-email">Email</label>
                <input id="d-email" class="input" type="email" formControlName="email" />
                @if (!editing()) { <span class="hint">If a Driver login with this email exists, it gets linked automatically.</span> }
              </div>
              <div class="field"><label for="d-phone">Phone</label><input id="d-phone" class="input" formControlName="phone" /></div>
              <div class="field"><label for="d-lic">Licence number</label><input id="d-lic" class="input" formControlName="licenseNumber" /></div>
              <div class="field"><label for="d-class">Licence class</label><input id="d-class" class="input" formControlName="licenseClass" /></div>
              <div class="field"><label for="d-exp">Licence expires</label><input id="d-exp" class="input" type="date" formControlName="licenseExpiry" /></div>
              <div class="field"><label for="d-hire">Hire date</label><input id="d-hire" class="input" type="date" formControlName="hireDate" /></div>
              <div class="field">
                <label for="d-status">Status</label>
                <select id="d-status" class="input" formControlName="status">
                  @for (s of statuses; track s) { <option [value]="s">{{ label(s) }}</option> }
                </select>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="formOpen.set(false)">Cancel</button>
            <button class="btn primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save driver' }}</button>
          </div>
        </form>
      </fp-modal>
    }
  `,
})
export class DriversComponent {
  private api = inject(DriverService);
  private fb = inject(FormBuilder);

  readonly pageSize = PAGE_SIZE;
  readonly statuses = DRIVER_STATUSES;

  items = signal<DriverDto[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(false);
  error = signal('');

  search = new FormControl('', { nonNullable: true });
  status = new FormControl('', { nonNullable: true });
  hasVehicle = new FormControl('', { nonNullable: true });
  expiring = new FormControl(false, { nonNullable: true });
  sort = signal({ by: 'lastName', dir: 'asc' });

  formOpen = signal(false);
  editing = signal<DriverDto | null>(null);
  saving = signal(false);
  formError = signal('');

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    licenseNumber: ['', [Validators.required, Validators.minLength(5)]],
    licenseClass: ['', Validators.required],
    licenseExpiry: ['', Validators.required],
    hireDate: ['', Validators.required],
    status: ['ACTIVE'],
  });

  constructor() {
    merge(this.search.valueChanges.pipe(debounceTime(300)), this.status.valueChanges, this.hasVehicle.valueChanges, this.expiring.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.goTo(1));
    this.load();
  }

  label(v: string) {
    const t = v.toLowerCase().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  isExpired(d: DriverDto) {
    return new Date(d.licenseExpiry) < new Date();
  }

  arrow(col: string) {
    return this.sort().by === col ? (this.sort().dir === 'asc' ? ' ▲' : ' ▼') : '';
  }

  sortBy(col: string) {
    const s = this.sort();
    this.sort.set({ by: col, dir: s.by === col && s.dir === 'asc' ? 'desc' : 'asc' });
    this.goTo(1);
  }

  goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  load() {
    this.loading.set(true);
    const vehicleFilter = this.hasVehicle.value;
    this.api
      .list({
        page: this.page(),
        pageSize: PAGE_SIZE,
        search: this.search.value,
        status: this.status.value,
        hasVehicle: vehicleFilter === '' ? undefined : vehicleFilter === 'true',
        licenseExpiringInDays: this.expiring.value ? 30 : undefined,
        sortBy: this.sort().by,
        sortDir: this.sort().dir,
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

  openForm(d?: DriverDto) {
    this.editing.set(d ?? null);
    this.formError.set('');
    this.form.reset({
      firstName: d?.firstName ?? '',
      lastName: d?.lastName ?? '',
      email: d?.email ?? '',
      phone: d?.phone ?? '',
      licenseNumber: d?.licenseNumber ?? '',
      licenseClass: d?.licenseClass ?? '',
      licenseExpiry: d ? d.licenseExpiry.slice(0, 10) : '',
      hireDate: d ? d.hireDate.slice(0, 10) : '',
      status: d?.status ?? 'ACTIVE',
    });
    this.formOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const current = this.editing();
    const request = current ? this.api.update(current.id, this.form.getRawValue()) : this.api.create(this.form.getRawValue());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.load();
      },
      error: (e) => {
        this.formError.set(errorMessage(e));
        this.saving.set(false);
      },
    });
  }

  remove(d: DriverDto) {
    if (!confirm(`Delete ${d.firstName} ${d.lastName}? This cannot be undone.`)) return;
    this.api.remove(d.id).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }
}
