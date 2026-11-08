import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { LoginResponse } from '../../../../../libs/shared/src';
import { AuthService } from './auth.service';

// If five requests fail with 401 at once we only want ONE refresh call, so they all share it.
let refreshInFlight: Observable<LoginResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const decorate = (r: HttpRequest<unknown>) => {
    const token = auth.token();
    return r.clone({
      // The API requires this header on cookie-based calls (small CSRF defence)
      setHeaders: { 'X-Requested-With': 'fleet-pulse', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };

  const isAuthCall = req.url.includes('/api/auth/');

  return next(decorate(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthCall) return throwError(() => err);

      refreshInFlight ??= auth.refresh().pipe(
        finalize(() => (refreshInFlight = null)),
        shareReplay(1),
      );

      return refreshInFlight.pipe(
        switchMap(() => next(decorate(req))),
        catchError((refreshErr) => {
          auth.endSession();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
