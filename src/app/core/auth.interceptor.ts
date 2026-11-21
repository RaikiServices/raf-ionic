import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { api } from './api-url';
import { AuthService } from './auth.service';
import { deviceId } from './device-id';
import { lang } from './i18n';

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

/**
 * L'identifiant d'appareil ne part que vers notre API, jamais vers un tiers. La langue
 * choisie aussi : le backend redige alors ses messages d'erreur en kreyol.
 */
function withDevice(request: HttpRequest<unknown>, id: string | null): HttpRequest<unknown> {
  if (!request.url.startsWith(api(''))) {
    return request;
  }
  const headers: Record<string, string> = { 'Accept-Language': lang() };
  if (id) {
    headers['X-Device-Id'] = id;
  }
  return request.clone({ setHeaders: headers });
}

/**
 * Ajoute le jeton d'acces et l'identifiant d'appareil ; sur un 401, rafraichit la
 * session une fois et rejoue.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  return from(deviceId()).pipe(
    switchMap((id) => {
      const base = withDevice(request, id);
      return next(withToken(base, auth.getAccessToken())).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          return from(auth.refresh()).pipe(
            switchMap((token) => (token ? next(withToken(base, token)) : throwError(() => error))),
          );
        }),
      );
    }),
  );
};
