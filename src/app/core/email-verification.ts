import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { errorCode } from './errors';

/**
 * Envoie le code puis relit le profil. Un email deja confirme (lien ouvert entre-temps)
 * compte comme un succes.
 */
export async function confirmEmailCode(apiService: ApiService, auth: AuthService, code: string): Promise<void> {
  try {
    await firstValueFrom(apiService.verifyEmailCode(code));
  } catch (e) {
    if (errorCode(e) !== 'EMAIL_ALREADY_VERIFIED') {
      throw e;
    }
  }
  try {
    await auth.setUser(await firstValueFrom(apiService.me()));
  } catch {
    // Le profil se mettra a jour a la prochaine ouverture.
  }
}
