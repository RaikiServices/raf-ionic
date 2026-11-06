import { formatCountdown } from './format';
import { Quiz, QuizStatus, Reward } from './models';

// Regles d'affichage d'un quiz, alignees sur Quiz.acceptsTickets / acceptsPlay du backend.

export const STATUS_LABELS: Record<QuizStatus, string> = {
  DRAFT: 'Brouillon',
  REGISTRATION: 'Inscriptions',
  SCHEDULED: 'Bientôt',
  RUNNING: 'En cours',
  CLOSING: 'Clôture',
  COMPUTING: 'Résultats',
  FINISHED: 'Terminé',
  CANCELLED: 'Annulé',
};

export function statusClass(status: QuizStatus): string {
  return status.toLowerCase();
}

export function acceptsTickets(quiz: Quiz): boolean {
  return ['REGISTRATION', 'SCHEDULED', 'RUNNING', 'CLOSING'].includes(quiz.status);
}

export function acceptsPlay(quiz: Quiz, now = Date.now()): boolean {
  if (quiz.status !== 'RUNNING' && quiz.status !== 'CLOSING') {
    return false;
  }
  return !quiz.endsAt || new Date(quiz.endsAt).getTime() > now;
}

/** Ordre d'affichage dans le lobby : ce qui se joue maintenant d'abord. */
export function statusRank(status: QuizStatus): number {
  return ['CLOSING', 'RUNNING', 'SCHEDULED', 'REGISTRATION', 'COMPUTING', 'FINISHED', 'CANCELLED', 'DRAFT'].indexOf(
    status,
  );
}

export function sortedRewards(quiz: Quiz): Reward[] {
  return [...quiz.rewards].sort((a, b) => a.rankFrom - b.rankFrom);
}

export function topPrizeHtg(quiz: Quiz): number {
  return sortedRewards(quiz)[0]?.amountHtg ?? 0;
}

export function totalPrizesHtg(quiz: Quiz): number {
  return quiz.rewards.reduce((sum, r) => sum + r.amountHtg * (r.rankTo - r.rankFrom + 1), 0);
}

export function rankLabel(reward: Reward): string {
  if (reward.rankFrom === reward.rankTo) {
    return reward.rankFrom === 1 ? '1er' : `${reward.rankFrom}e`;
  }
  return `${reward.rankFrom}e – ${reward.rankTo}e`;
}

/** Phrase d'etat avec son compte a rebours, selon le statut. */
export function statusLine(quiz: Quiz, now: number): { text: string; urgent: boolean } {
  const until = (iso: string | null) => (iso ? new Date(iso).getTime() - now : 0);
  switch (quiz.status) {
    case 'REGISTRATION': {
      const missing = Math.max(0, quiz.minPlayers - quiz.playersRegistered);
      return {
        text: missing > 0 ? `Encore ${missing} joueur${missing > 1 ? 's' : ''} pour lancer le quiz` : 'Lancement imminent',
        urgent: false,
      };
    }
    case 'SCHEDULED':
      return { text: `Démarre dans ${formatCountdown(until(quiz.scheduledStartAt))}`, urgent: false };
    case 'RUNNING':
      return { text: 'Ouvert : joue quand tu veux !', urgent: false };
    case 'CLOSING':
      return { text: `Fin dans ${formatCountdown(until(quiz.endsAt))}`, urgent: true };
    case 'COMPUTING':
      return { text: 'Calcul du classement…', urgent: false };
    case 'FINISHED':
      return { text: 'Classement publié', urgent: false };
    case 'CANCELLED':
      return { text: 'Quiz annulé, tickets remboursés', urgent: false };
    default:
      return { text: '', urgent: false };
  }
}

/** Couleurs de la carte quand le quiz n'a pas de banniere : des teintes de la palette orange -> blanc. */
/** Degrade de secours d'une vignette sans image, stable pour un meme id (quiz ou categorie). */
export function themeGradient(item: { id: number }): string {
  const palettes = [
    ['#ffc078', '#ff9a1a'],
    ['#ffe7cc', '#ffad47'],
    ['#ffd4a3', '#ff9a1a'],
    ['#fff4e6', '#ffc078'],
    ['#ffad47', '#e08816'],
    ['#ffffff', '#ffd4a3'],
  ];
  const [a, b] = palettes[item.id % palettes.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
