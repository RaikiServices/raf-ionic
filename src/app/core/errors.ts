import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from './models';
import { t } from './i18n';

/** Code d'erreur de l'API (ex. INSUFFICIENT_FUNDS), ou null. */
export function errorCode(error: unknown): string | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return (error.error as ApiError).code ?? null;
  }
  return null;
}

/**
 * Message a montrer au joueur. Le backend redige ses messages dans la langue
 * envoyee par l'app (Accept-Language).
 */
export function errorMessage(error: unknown, fallback = t('Une erreur est survenue. Réessaie.')): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return t('Pas de connexion. Vérifie ton réseau et réessaie.');
    }
    const body = error.error as ApiError | null;
    if (body && typeof body === 'object') {
      const field = body.fieldErrors?.[0]?.message;
      return field || body.message || fallback;
    }
    if (error.status >= 500) {
      return t('Le serveur ne répond pas correctement. Réessaie dans un instant.');
    }
  }
  return fallback;
}
