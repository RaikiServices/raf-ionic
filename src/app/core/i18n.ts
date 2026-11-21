import { Pipe, PipeTransform, signal } from '@angular/core';

import { HT } from './i18n-ht';
import { storage } from './storage';

/*
 * Langue de l'application : francais (par defaut) ou kreyol ayisyen.
 *
 * Les textes restent ecrits en francais dans le code ; le francais sert de cle et
 * HT (i18n-ht.ts) donne la traduction. Un texte absent de HT s'affiche en francais :
 * un oubli ne casse rien. Les parties variables s'ecrivent {nom} dans les deux
 * langues : t('Il reste {n} places', { n: 3 }).
 *
 * Le choix est garde sur l'appareil (pas sur le compte).
 */

export type Lang = 'fr' | 'ht';

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'ht', label: 'Kreyòl' },
];

const KEY = 'raf.lang';

function readSync(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ht' ? 'ht' : 'fr';
  } catch {
    return 'fr';
  }
}

/** Langue courante. Lue dans un template ou un computed, elle les met a jour. */
export const lang = signal<Lang>(readSync());

export function setLang(value: Lang): void {
  lang.set(value);
  document.documentElement.lang = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Navigation privee : le choix vaut pour la session.
  }
  // Sur telephone, le localStorage d'une WebView peut etre vide par le systeme.
  void storage.set(KEY, value);
}

/** Au demarrage : reprend le choix garde par Preferences si le localStorage l'a perdu. */
export async function restoreLang(): Promise<void> {
  document.documentElement.lang = lang();
  const saved = await storage.get(KEY);
  if ((saved === 'fr' || saved === 'ht') && saved !== lang()) {
    setLang(saved);
  }
}

/** Texte dans la langue courante. */
export function t(fr: string, params?: Record<string, string | number>): string {
  let text = lang() === 'ht' ? (HT[fr] ?? fr) : fr;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/**
 * {{ 'Jouer' | t }}, {{ 'Il reste {n} places' | t: { n: places() } }}.
 * Impur : il relit la langue a chaque verification (une simple recherche dans un objet).
 */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(fr: string, params?: Record<string, string | number>): string {
    return t(fr, params);
  }
}
