import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AssignmentDto, Paginated, VehicleDto } from '@fleet-pulse/shared';
import { toParams } from '../../core/api';

export interface VehicleFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  unassigned?: boolean;
  sortBy?: string;
  sortDir?: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private http = inject(HttpClient);
  private base = '/api/vehicles';

  list(filters: VehicleFilters) {
    return this.http.get<Paginated<VehicleDto>>(this.base, {
      params: toParams({ ...filters, unassigned: filters.unassigned || undefined }),
    });
  }
  mine() { return this.http.get<VehicleDto | null>(`${this.base}/mine`); }
  history(id: string) { return this.http.get<AssignmentDto[]>(`${this.base}/${id}/assignments`); }
  create(body: unknown) { return this.http.post<VehicleDto>(this.base, body); }
  update(id: string, body: unknown) { return this.http.patch<VehicleDto>(`${this.base}/${id}`, body); }
  remove(id: string) { return this.http.delete<void>(`${this.base}/${id}`); }
  assign(id: string, body: { driverId: string; notes?: string }) { return this.http.post(`${this.base}/${id}/assign`, body); }
  unassign(id: string, body: { odometerKm?: number } = {}) { return this.http.post<void>(`${this.base}/${id}/unassign`, body); }
}
