import { lang, t } from './i18n';

// Mise en forme des nombres, montants, durees et dates (heure de l'appareil).

const numberFormat = new Intl.NumberFormat('fr-FR');
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Les navigateurs ne connaissent pas tous le kreyol (ht) : mois ecrits a la main.
const HT_MONTHS = ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'];

function shortDate(date: Date): string {
  return lang() === 'ht' ? `${date.getDate()} ${HT_MONTHS[date.getMonth()].slice(0, 4)}.` : shortDateFormat.format(date);
}

function longDate(date: Date): string {
  return lang() === 'ht'
    ? `${date.getDate()} ${HT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
    : dateFormat.format(date);
}
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatNumber(value: number | null | undefined): string {
  return numberFormat.format(value ?? 0);
}

export function formatHtg(value: number | null | undefined): string {
  return `${formatNumber(value)} HTG`;
}

/** « 19 oct. à 16:05 », ou « aujourd'hui à 16:05 ». */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return t("aujourd'hui à {heure}", { heure: timeFormat.format(date) });
  }
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (date.toDateString() === tomorrow.toDateString()) {
    return t('demain à {heure}', { heure: timeFormat.format(date) });
  }
  return t('{date} à {heure}', { date: shortDate(date), heure: timeFormat.format(date) });
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? longDate(new Date(iso)) : '—';
}

/** Compte a rebours : « 2 j 04 h », « 1 h 05 min », « 04:59 ». */
export function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days} j ${pad(hours)} h`;
  }
  if (hours > 0) {
    return `${hours} h ${pad(minutes)} min`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** « il y a 5 min », « il y a 2 h », sinon la date. */
export function formatAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return t("à l'instant");
  }
  if (minutes < 60) {
    return t('il y a {n} min', { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('il y a {n} h', { n: hours });
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? t('hier') : t('il y a {n} jours', { n: days });
  }
  return formatDate(iso);
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${(firstName ?? '').charAt(0)}${(lastName ?? '').charAt(0)}`.toUpperCase() || '?';
}
