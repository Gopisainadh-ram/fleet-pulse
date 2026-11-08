import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummary } from '../../../../../../libs/shared/src';
import { errorMessage } from '../../core/api';
import { BadgeComponent } from '../../shared/badge.component';

@Component({
  selector: 'fp-dashboard',
  imports: [DatePipe, DecimalPipe, RouterLink, BadgeComponent],
  template: `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p>Where the fleet stands right now.</p>
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (data(); as d) {
      <div class="kpis">
        <div class="kpi">
          <div class="value">{{ d.totals.vehicles }}</div>
          <div class="label">Vehicles</div>
        </div>
        <div class="kpi">
          <div class="value">{{ d.totals.inUse }}</div>
          <div class="label">On the road</div>
        </div>
        <div class="kpi">
          <div class="value">{{ d.totals.activeDrivers }}</div>
          <div class="label">Active drivers</div>
        </div>
        <div class="kpi">
          <div class="value">{{ d.totals.utilisationPct }}%</div>
          <div class="label">Fleet in use</div>
        </div>
      </div>

      <div class="dash-grid">
        <section class="panel panel-pad">
          <h2>Vehicles by status</h2>
          @for (s of d.vehiclesByStatus; track s.status) {
            <div class="bar-row">
              <fp-badge [value]="s.status" />
              <div class="bar-track">
                <div
                  class="bar-fill"
                  [class.in-use]="s.status === 'IN_USE'"
                  [style.width.%]="pct(s.count, d.totals.vehicles)"
                ></div>
              </div>
              <span class="num">{{ s.count }}</span>
            </div>
          }
        </section>

        <section class="panel panel-pad">
          <h2>Assignments, last 6 months</h2>
          @if (d.assignmentsByMonth.length) {
            <div class="trend">
              @for (m of d.assignmentsByMonth; track m.month) {
                <div class="trend-col">
                  <span class="num">{{ m.assignments }}</span>
                  <div class="bar" [style.height.%]="pct(m.assignments, maxMonth())"></div>
                  <span>{{ m.month + '-01' | date: 'MMM' }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="empty">No assignments yet.</div>
          }
        </section>

        <section class="panel panel-pad">
          <h2>Licences expiring within 30 days</h2>
          <ul class="list">
            @for (l of d.licencesExpiring; track l.id) {
              <li>
                <span>{{ l.name }}</span>
                <span [class]="l.daysLeft < 0 ? 'badge bad' : 'badge warn'">
                  {{
                    l.daysLeft < 0 ? 'Expired ' + -l.daysLeft + 'd ago' : l.daysLeft + ' days left'
                  }}
                </span>
              </li>
            } @empty {
              <li class="sub">Nothing coming up.</li>
            }
          </ul>
          <a routerLink="/drivers">See all drivers</a>
        </section>

        <section class="panel panel-pad">
          <h2>Insurance expiring within 30 days</h2>
          <ul class="list">
            @for (i of d.insuranceExpiring; track i.id) {
              <li>
                <span>{{ i.plateNumber }}</span>
                <span [class]="i.daysLeft < 0 ? 'badge bad' : 'badge warn'">
                  {{
                    i.daysLeft < 0 ? 'Expired ' + -i.daysLeft + 'd ago' : i.daysLeft + ' days left'
                  }}
                </span>
              </li>
            } @empty {
              <li class="sub">Nothing coming up.</li>
            }
          </ul>
        </section>

        <section class="panel panel-pad">
          <h2>Average mileage by type</h2>
          <ul class="list">
            @for (t of d.vehiclesByType; track t.type) {
              <li>
                <span
                  >{{ t.type }} <span class="sub">({{ t.count }})</span></span
                ><span class="num">{{ t.avgOdometerKm | number }} km</span>
              </li>
            }
          </ul>
        </section>

        <section class="panel panel-pad">
          <h2>Busiest drivers</h2>
          <ul class="list">
            @for (b of d.busiestDrivers; track b.id) {
              <li>
                <span>{{ b.name }}</span
                ><span class="num">{{ b.assignments }} assignments</span>
              </li>
            } @empty {
              <li class="sub">No data yet.</li>
            }
          </ul>
        </section>
      </div>
    } @else if (!error()) {
      <div class="empty">Loading…</div>
    }
  `,
})
export class DashboardComponent {
  data = signal<DashboardSummary | null>(null);
  error = signal('');
  maxMonth = computed(() =>
    Math.max(1, ...(this.data()?.assignmentsByMonth.map((m) => m.assignments) ?? [1])),
  );

  constructor() {
    inject(HttpClient)
      .get<DashboardSummary>('/api/dashboard')
      .subscribe({ next: (d) => this.data.set(d), error: (e) => this.error.set(errorMessage(e)) });
  }

  pct(value: number, max: number) {
    return max ? Math.round((value / max) * 100) : 0;
  }
}
