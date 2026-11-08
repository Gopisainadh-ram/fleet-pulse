import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DriverDto, Paginated } from '@fleet-pulse/shared';
import { toParams } from '../../core/api';

export interface DriverFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  hasVehicle?: boolean;
  licenseExpiringInDays?: number;
  sortBy?: string;
  sortDir?: string;
}

@Injectable({ providedIn: 'root' })
export class DriverService {
  private http = inject(HttpClient);
  private base = '/api/drivers';

  list(filters: DriverFilters) {
    return this.http.get<Paginated<DriverDto>>(this.base, { params: toParams({ ...filters }) });
  }
  mine() { return this.http.get<DriverDto>(`${this.base}/me`); }
  create(body: unknown) { return this.http.post<DriverDto>(this.base, body); }
  update(id: string, body: unknown) { return this.http.patch<DriverDto>(`${this.base}/${id}`, body); }
  remove(id: string) { return this.http.delete<void>(`${this.base}/${id}`); }
}
