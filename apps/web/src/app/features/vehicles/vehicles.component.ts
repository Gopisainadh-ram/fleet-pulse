import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, merge } from 'rxjs';
import { DriverDto, FUEL_TYPES, VehicleDto, VEHICLE_STATUSES, VEHICLE_TYPES } from '@fleet-pulse/shared';
import { errorMessage } from '../../core/api';
import { HasPermissionDirective } from '../../core/has-permission.directive';
import { BadgeComponent } from '../../shared/badge.component';
import { ModalComponent } from '../../shared/modal.component';
import { PagerComponent } from '../../shared/pager.component';
import { DriverService } from '../drivers/driver.service';
import { VehicleService } from './vehicle.service';

const PAGE_SIZE = 10;

@Component({
  selector: 'fp-vehicles',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, HasPermissionDirective, ModalComponent, PagerComponent, BadgeComponent],
  template: `
    <div class="page-head">
      <div>
        <h1>Vehicles</h1>
        <p>{{ total() }} in the fleet</p>
      </div>
      <button *fpCan="'vehicle:write'" class="btn primary" (click)="openForm()">Add vehicle</button>
    </div>

    <div class="toolbar">
      <input class="input grow" type="search" placeholder="Search plate, VIN, make, model or driver" [formControl]="search" aria-label="Search vehicles" />
      <select class="input" [formControl]="status" aria-label="Filter by status">
        <option value="">Any status</option>
        @for (s of statuses; track s) { <option [value]="s">{{ label(s) }}</option> }
      </select>
      <select class="input" [formControl]="type" aria-label="Filter by type">
        <option value="">Any type</option>
        @for (t of types; track t) { <option [value]="t">{{ label(t) }}</option> }
      </select>
      <label class="check"><input type="checkbox" [formControl]="unassigned" /> No driver</label>
    </div>

    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }

    <div class="panel">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th><button (click)="sortBy('plateNumber')">Plate{{ arrow('plateNumber') }}</button></th>
              <th><button (click)="sortBy('make')">Vehicle{{ arrow('make') }}</button></th>
              <th>Status</th>
              <th>Driver</th>
              <th><button (click)="sortBy('odometerKm')">Odometer{{ arrow('odometerKm') }}</button></th>
              <th><button (click)="sortBy('insuranceExpiry')">Insurance{{ arrow('insuranceExpiry') }}</button></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (v of items(); track v.id) {
              <tr>
                <td data-label="Plate"><strong>{{ v.plateNumber }}</strong></td>
                <td data-label="Vehicle">{{ v.make }} {{ v.model }} <span class="sub">{{ v.year }} · {{ label(v.fuelType) }}</span></td>
                <td data-label="Status"><fp-badge [value]="v.status" /></td>
                <td data-label="Driver">{{ v.currentDriver ? v.currentDriver.firstName + ' ' + v.currentDriver.lastName : '—' }}</td>
                <td data-label="Odometer" class="num">{{ v.odometerKm | number }} km</td>
                <td data-label="Insurance">{{ v.insuranceExpiry | date: 'dd MMM yyyy' }}</td>
                <td class="actions-cell">
                  <div class="actions">
                    @if (v.status === 'AVAILABLE') {
                      <button *fpCan="'vehicle:assign'" class="btn sm" (click)="openAssign(v)">Assign</button>
                    }
                    @if (v.status === 'IN_USE') {
                      <button *fpCan="'vehicle:assign'" class="btn sm" (click)="unassign(v)">Unassign</button>
                    }
                    <button *fpCan="'vehicle:write'" class="btn sm" (click)="openForm(v)">Edit</button>
                    <button *fpCan="'vehicle:delete'" class="btn sm danger" (click)="remove(v)">Delete</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7"><div class="empty">{{ loading() ? 'Loading…' : 'No vehicles match those filters.' }}</div></td></tr>
            }
          </tbody>
        </table>
      </div>
      <fp-pager [page]="page()" [pageSize]="pageSize" [total]="total()" [totalPages]="totalPages()" (pageChange)="goTo($event)" />
    </div>

    @if (formOpen()) {
      <fp-modal [title]="editing() ? 'Edit vehicle' : 'Add vehicle'" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            @if (formError()) { <div class="alert error" role="alert">{{ formError() }}</div> }
            <div class="form-grid">
              <div class="field">
                <label for="v-plate">Plate number</label>
                <input id="v-plate" class="input" formControlName="plateNumber" />
              </div>
              <div class="field">
                <label for="v-vin">VIN</label>
                <input id="v-vin" class="input" formControlName="vin" />
                @if (form.controls.vin.touched && form.controls.vin.invalid) { <span class="err">11 to 17 letters or digits</span> }
              </div>
              <div class="field"><label for="v-make">Make</label><input id="v-make" class="input" formControlName="make" /></div>
              <div class="field"><label for="v-model">Model</label><input id="v-model" class="input" formControlName="model" /></div>
              <div class="field"><label for="v-year">Year</label><input id="v-year" class="input" type="number" formControlName="year" /></div>
              <div class="field">
                <label for="v-type">Type</label>
                <select id="v-type" class="input" formControlName="type">
                  @for (t of types; track t) { <option [value]="t">{{ label(t) }}</option> }
                </select>
              </div>
              <div class="field">
                <label for="v-fuel">Fuel</label>
                <select id="v-fuel" class="input" formControlName="fuelType">
                  @for (f of fuels; track f) { <option [value]="f">{{ label(f) }}</option> }
                </select>
              </div>
              <div class="field"><label for="v-odo">Odometer (km)</label><input id="v-odo" class="input" type="number" formControlName="odometerKm" /></div>
              <div class="field"><label for="v-ins">Insurance expires</label><input id="v-ins" class="input" type="date" formControlName="insuranceExpiry" /></div>
              <div class="field">
                <label for="v-status">Status</label>
                <select id="v-status" class="input" formControlName="status">
                  @for (s of editableStatuses; track s) { <option [value]="s">{{ label(s) }}</option> }
                </select>
                @if (editing()?.status === 'IN_USE') { <span class="hint">Unassign the driver to change this.</span> }
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="formOpen.set(false)">Cancel</button>
            <button class="btn primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save vehicle' }}</button>
          </div>
        </form>
      </fp-modal>
    }

    @if (assignTarget(); as target) {
      <fp-modal [title]="'Assign ' + target.plateNumber" (closed)="assignTarget.set(null)">
        <form [formGroup]="assignForm" (ngSubmit)="confirmAssign(target)">
          <div class="modal-body">
            @if (formError()) { <div class="alert error" role="alert">{{ formError() }}</div> }
            <div class="field">
              <label for="a-driver">Driver</label>
              <select id="a-driver" class="input" formControlName="driverId">
                <option value="">Choose a driver</option>
                @for (d of freeDrivers(); track d.id) { <option [value]="d.id">{{ d.firstName }} {{ d.lastName }} ({{ d.licenseClass }})</option> }
              </select>
              <span class="hint">Only active drivers without a vehicle and with a valid licence are listed.</span>
            </div>
            <div class="field"><label for="a-notes">Notes (optional)</label><input id="a-notes" class="input" formControlName="notes" /></div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="assignTarget.set(null)">Cancel</button>
            <button class="btn primary" [disabled]="assignForm.invalid || saving()">Assign vehicle</button>
          </div>
        </form>
      </fp-modal>
    }
  `,
})
export class VehiclesComponent {
  private api = inject(VehicleService);
  private driverApi = inject(DriverService);
  private fb = inject(FormBuilder);

  readonly pageSize = PAGE_SIZE;
  readonly statuses = VEHICLE_STATUSES;
  readonly editableStatuses = ['AVAILABLE', 'MAINTENANCE', 'RETIRED'];
  readonly types = VEHICLE_TYPES;
  readonly fuels = FUEL_TYPES;

  items = signal<VehicleDto[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(false);
  error = signal('');

  search = new FormControl('', { nonNullable: true });
  status = new FormControl('', { nonNullable: true });
  type = new FormControl('', { nonNullable: true });
  unassigned = new FormControl(false, { nonNullable: true });
  sort = signal({ by: 'plateNumber', dir: 'asc' });

  formOpen = signal(false);
  editing = signal<VehicleDto | null>(null);
  saving = signal(false);
  formError = signal('');
  assignTarget = signal<VehicleDto | null>(null);
  freeDrivers = signal<DriverDto[]>([]);

  form = this.fb.nonNullable.group({
    plateNumber: ['', [Validators.required, Validators.minLength(4)]],
    vin: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{11,17}$/)]],
    make: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1990)]],
    type: ['SEDAN'],
    fuelType: ['PETROL'],
    odometerKm: [0, [Validators.required, Validators.min(0)]],
    insuranceExpiry: ['', Validators.required],
    status: ['AVAILABLE'],
  });

  assignForm = this.fb.nonNullable.group({
    driverId: ['', Validators.required],
    notes: [''],
  });

  constructor() {
    merge(this.search.valueChanges.pipe(debounceTime(300)), this.status.valueChanges, this.type.valueChanges, this.unassigned.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.goTo(1));
    this.load();
  }

  label(v: string) {
    const t = v.toLowerCase().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
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
    this.api
      .list({
        page: this.page(),
        pageSize: PAGE_SIZE,
        search: this.search.value,
        status: this.status.value,
        type: this.type.value,
        unassigned: this.unassigned.value,
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

  openForm(v?: VehicleDto) {
    this.editing.set(v ?? null);
    this.formError.set('');
    this.form.reset({
      plateNumber: v?.plateNumber ?? '',
      vin: v?.vin ?? '',
      make: v?.make ?? '',
      model: v?.model ?? '',
      year: v?.year ?? new Date().getFullYear(),
      type: v?.type ?? 'SEDAN',
      fuelType: v?.fuelType ?? 'PETROL',
      odometerKm: v?.odometerKm ?? 0,
      insuranceExpiry: v ? v.insuranceExpiry.slice(0, 10) : '',
      status: v && v.status !== 'IN_USE' ? v.status : 'AVAILABLE',
    });
    // A vehicle on the road can't have its status edited by hand
    if (v?.status === 'IN_USE') this.form.controls.status.disable();
    else this.form.controls.status.enable();
    this.formOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const body = this.form.value; // disabled controls are left out
    const current = this.editing();
    const request = current ? this.api.update(current.id, body) : this.api.create(body);

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

  openAssign(v: VehicleDto) {
    this.formError.set('');
    this.assignForm.reset();
    this.assignTarget.set(v);
    this.driverApi
      .list({ page: 1, pageSize: 100, status: 'ACTIVE', hasVehicle: false })
      .subscribe((r) => this.freeDrivers.set(r.items.filter((d) => new Date(d.licenseExpiry) > new Date())));
  }

  confirmAssign(v: VehicleDto) {
    if (this.assignForm.invalid) return;
    this.saving.set(true);
    const { driverId, notes } = this.assignForm.getRawValue();
    this.api.assign(v.id, { driverId, notes: notes || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignTarget.set(null);
        this.load();
      },
      error: (e) => {
        this.formError.set(errorMessage(e));
        this.saving.set(false);
      },
    });
  }

  unassign(v: VehicleDto) {
    if (!confirm(`Take ${v.plateNumber} back from ${v.currentDriver?.firstName ?? 'the driver'}?`)) return;
    this.api.unassign(v.id).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }

  remove(v: VehicleDto) {
    if (!confirm(`Delete ${v.plateNumber}? This cannot be undone.`)) return;
    this.api.remove(v.id).subscribe({ next: () => this.load(), error: (e) => this.error.set(errorMessage(e)) });
  }
}
