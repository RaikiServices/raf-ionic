import { environment } from '../../environments/environment';
import { lang } from './i18n';

/** Sujets du guide d'aide du site (raf-frontend-ssr, client/help/help-content.ts). */
export type HelpTopic = 'email' | 'installer' | 'notifications' | 'mot-de-passe';

/**
 * Adresse du guide d'aide pas a pas, sur le site. Le telephone est transmis
 * (?appareil=) pour que le guide saute la question « Android ou iPhone ? ».
 */
export function helpUrl(topic?: HelpTopic): string {
  const url = new URL(topic ? `/aide/${topic}` : '/aide', environment.siteUrl);
  const ua = navigator.userAgent;
  const device = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? 'iphone'
    : /Android/.test(ua)
      ? 'android'
      : null;
  if (device) {
    url.searchParams.set('appareil', device);
  }
  // Le guide s'ouvre dans la langue de l'app (le site retient ensuite ce choix).
  url.searchParams.set('lang', lang());
  return url.href;
}

/** Ouvre le guide dans le navigateur, sans quitter l'app (onglet ou fenetre a part). */
export function openHelp(topic?: HelpTopic): void {
  window.open(helpUrl(topic), '_blank', 'noopener');
}
