import { HttpParams } from '@angular/common/http';

// Turns { page: 1, search: '' , status: undefined } into ?page=1 (drops empty values)
export function toParams(obj: Record<string, string | number | boolean | null | undefined>) {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

// Pulls a readable message out of the API's error shape
export function errorMessage(err: any, fallback = 'Something went wrong. Please try again.') {
  const e = err?.error?.error;
  if (e?.fields?.length) return e.fields.map((f: any) => `${f.path}: ${f.message}`).join(', ');
  return e?.message ?? fallback;
}
