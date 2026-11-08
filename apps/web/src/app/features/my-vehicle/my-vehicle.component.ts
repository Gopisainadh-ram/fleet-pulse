import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DriverDto, VehicleDto } from '@fleet-pulse/shared';
import { errorMessage } from '../../core/api';
import { BadgeComponent } from '../../shared/badge.component';
import { DriverService } from '../drivers/driver.service';
import { VehicleService } from '../vehicles/vehicle.service';

// The only screen a DRIVER account sees: their own profile and the vehicle they have now.
@Component({
  selector: 'fp-my-vehicle',
  imports: [DatePipe, DecimalPipe, BadgeComponent],
  template: `
    <div class="page-head"><div><h1>My vehicle</h1><p>What you're driving and when your paperwork runs out.</p></div></div>

    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @if (loaded()) {
      <div class="dash-grid">
        <section class="panel panel-pad">
          <h2>Current vehicle</h2>
          @if (vehicle(); as v) {
            <ul class="list">
              <li><span>Plate</span><strong>{{ v.plateNumber }}</strong></li>
              <li><span>Vehicle</span><span>{{ v.make }} {{ v.model }} ({{ v.year }})</span></li>
              <li><span>Odometer</span><span class="num">{{ v.odometerKm | number }} km</span></li>
              <li><span>Insurance until</span><span>{{ v.insuranceExpiry | date: 'dd MMM yyyy' }}</span></li>
            </ul>
          } @else {
            <div class="empty">No vehicle assigned right now.</div>
          }
        </section>

        @if (profile(); as p) {
          <section class="panel panel-pad">
            <h2>My licence</h2>
            <ul class="list">
              <li><span>Name</span><span>{{ p.firstName }} {{ p.lastName }}</span></li>
              <li><span>Licence</span><span>{{ p.licenseNumber }} ({{ p.licenseClass }})</span></li>
              <li><span>Expires</span><span>{{ p.licenseExpiry | date: 'dd MMM yyyy' }}</span></li>
              <li><span>Status</span><fp-badge [value]="p.status" /></li>
            </ul>
          </section>
        }
      </div>
    }
  `,
})
export class MyVehicleComponent {
  vehicle = signal<VehicleDto | null>(null);
  profile = signal<DriverDto | null>(null);
  loaded = signal(false);
  error = signal('');

  constructor() {
    forkJoin({ vehicle: inject(VehicleService).mine(), profile: inject(DriverService).mine() }).subscribe({
      next: (r) => {
        this.vehicle.set(r.vehicle);
        this.profile.set(r.profile);
        this.loaded.set(true);
      },
      error: (e) => this.error.set(errorMessage(e, 'Could not load your details.')),
    });
  }
}
