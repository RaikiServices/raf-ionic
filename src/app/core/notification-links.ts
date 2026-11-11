import { AppNotification, NotificationType } from './models';

// Ou mene une notification, et son icone. Memes destinations que les liens du backend.

const ICONS: Partial<Record<NotificationType, string>> = {
  QUIZ_SCHEDULED: 'clock',
  QUIZ_STARTED: 'flame',
  QUIZ_CLOSING: 'hourglass',
  QUIZ_CANCELLED: 'gift',
  QUIZ_RESULTS: 'trophy',
  SOLO_QUIZ_OPENED: 'flame',
  GROUP_QUIZ_OPENED: 'users',
  PRIZE_WON: 'crown',
  TOPUP_CONFIRMED: 'coin',
  WITHDRAWAL_APPROVED: 'check',
  WITHDRAWAL_PAID: 'cash',
  WITHDRAWAL_PARTIALLY_PAID: 'cash',
  WITHDRAWAL_CLOSED: 'coin',
  WITHDRAWAL_REJECTED: 'cross',
  ANNOUNCEMENT: 'info',
  ADMIN_RECONCILIATION_ALERT: 'warning',
};

export function notificationIcon(n: AppNotification): string {
  return ICONS[n.type] ?? 'bell';
}

export function notificationLink(n: AppNotification): string | null {
  let data: Record<string, unknown> = {};
  try {
    data = n.data ? JSON.parse(n.data) : {};
  } catch {
    // donnees illisibles : pas de lien
  }
  const quizId = data['quizId'];
  switch (n.type) {
    case 'QUIZ_SCHEDULED':
    case 'QUIZ_STARTED':
    case 'QUIZ_CLOSING':
    case 'QUIZ_CANCELLED':
    // Un quiz solo y est redirige vers son ecran de jeu.
    case 'SOLO_QUIZ_OPENED':
    case 'GROUP_QUIZ_OPENED':
      return quizId ? `/quiz/${quizId}` : null;
    case 'QUIZ_RESULTS':
    case 'PRIZE_WON':
      return quizId ? `/quiz/${quizId}/classement` : null;
    case 'TOPUP_CONFIRMED':
      return '/portefeuille';
    case 'WITHDRAWAL_APPROVED':
    case 'WITHDRAWAL_PAID':
    case 'WITHDRAWAL_PARTIALLY_PAID':
    case 'WITHDRAWAL_CLOSED':
    case 'WITHDRAWAL_REJECTED':
      return '/portefeuille/retraits';
    case 'ANNOUNCEMENT':
      return internalPath(data['path']);
    default:
      return null;
  }
}

/** Chemin interne a l'app uniquement : jamais d'adresse externe (//site, https://...). */
function internalPath(value: unknown): string | null {
  return typeof value === 'string' && /^\/(?![/\\])\S*$/.test(value) ? value : null;
}
