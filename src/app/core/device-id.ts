import { Device } from '@capacitor/device';

/**
 * Identifiant stable de l'appareil, envoye a l'API dans l'en-tete X-Device-Id.
 *
 * Le serveur s'en sert pour limiter le solo a une partie par sujet et par jour sur
 * un meme appareil, tous comptes confondus. Sur Android c'est l'ANDROID_ID (qui
 * survit a une reinstallation), sur iOS l'identifierForVendor ; sur le web, un
 * identifiant tire au hasard et garde dans le navigateur.
 */
let cached: Promise<string | null> | null = null;

export function deviceId(): Promise<string | null> {
  cached ??= Device.getId()
    .then(({ identifier }) => (identifier && /^[A-Za-z0-9._:-]{8,64}$/.test(identifier) ? identifier : null))
    .catch(() => null);
  return cached;
}
