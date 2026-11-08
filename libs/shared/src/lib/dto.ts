import { Role } from './roles';

// ---- Shared enums ----
export const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'] as const;

export const VEHICLE_TYPES = ['SEDAN', 'SUV', 'VAN', 'TRUCK', 'BUS', 'MOTORCYCLE'] as const;

export const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'] as const;

export const DRIVER_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type FuelType = (typeof FUEL_TYPES)[number];
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

// ---- Auth ----
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ---- Generic list wrapper ----
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- Users ----
export interface UserDto extends AuthUser {
  isActive: boolean;
  setupComplete: boolean;
  createdAt: string;
}

// ---- Drivers ----
export interface DriverDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  status: DriverStatus;
  hireDate: string;
  currentVehicle: { id: string; plateNumber: string; make: string; model: string } | null;
}

// ---- Vehicles ----
export interface VehicleDto {
  id: string;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  status: VehicleStatus;
  odometerKm: number;
  insuranceExpiry: string;
  currentDriver: { id: string; firstName: string; lastName: string } | null;
}

export interface AssignmentDto {
  id: string;
  assignedAt: string;
  unassignedAt: string | null;
  notes: string | null;
  driver: { id: string; firstName: string; lastName: string };
}

// ---- Dashboard ----
export interface DashboardSummary {
  totals: { vehicles: number; activeDrivers: number; inUse: number; utilisationPct: number };
  vehiclesByStatus: { status: VehicleStatus; count: number }[];
  vehiclesByType: { type: VehicleType; count: number; avgOdometerKm: number }[];
  licencesExpiring: { id: string; name: string; licenseExpiry: string; daysLeft: number }[];
  insuranceExpiring: {
    id: string;
    plateNumber: string;
    insuranceExpiry: string;
    daysLeft: number;
  }[];
  busiestDrivers: { id: string; name: string; assignments: number }[];
  assignmentsByMonth: { month: string; assignments: number }[];
}
