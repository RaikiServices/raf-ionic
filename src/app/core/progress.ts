import { BadgeId, MissionId, PlayerTitle, Progress } from './models';

/*
 * Textes de la progression (missions, badges, titres), par identifiant du serveur.
 * Ecrits en francais, traduits par le pipe t comme le reste de l'app (i18n-ht.ts).
 */

export const TITLES: Record<PlayerTitle, string> = {
  BEGINNER: 'Débutant',
  APPRENTICE: 'Apprenti',
  CONNOISSEUR: 'Connaisseur',
  EXPERT: 'Expert',
  MASTER: 'Maître',
  LEGEND: 'Légende',
};

/** Texte de la mission ; {n} = objectif. */
export const MISSIONS: Record<MissionId, { text: string; icon: string }> = {
  PLAY_ONE: { text: 'Termine une partie ou un entraînement', icon: 'ticket' },
  CORRECT_TEN: { text: 'Trouve {n} bonnes réponses', icon: 'check' },
  TWO_SUBJECTS: { text: 'Joue sur {n} sujets différents', icon: 'question' },
};

export const BADGES: Record<BadgeId, { title: string; text: string; icon: string }> = {
  FIRST_GAME: { title: 'Premier pas', text: 'Termine ta première partie', icon: 'gift' },
  PRACTICE_5: { title: 'Bon élève', text: 'Termine {n} entraînements', icon: 'check' },
  GAMES_10: { title: 'Habitué', text: 'Joue {n} parties', icon: 'ticket' },
  GAMES_50: { title: 'Passionné', text: 'Joue {n} parties', icon: 'ticket' },
  GAMES_200: { title: 'Accro', text: 'Joue {n} parties', icon: 'chest' },
  CORRECT_100: { title: 'Tête bien faite', text: 'Trouve {n} bonnes réponses', icon: 'star' },
  CORRECT_1000: { title: 'Encyclopédie', text: 'Trouve {n} bonnes réponses', icon: 'crown' },
  STREAK_3: { title: 'Régulier', text: 'Joue {n} jours de suite', icon: 'flame' },
  STREAK_7: { title: 'Assidu', text: 'Joue {n} jours de suite', icon: 'flame' },
  STREAK_30: { title: 'Inarrêtable', text: 'Joue {n} jours de suite', icon: 'flame' },
  SUBJECTS_5: { title: 'Explorateur', text: 'Joue sur {n} sujets différents', icon: 'question' },
  PERFECT: { title: 'Sans-faute', text: 'Réussis un sans-faute en solo', icon: 'crown' },
  PODIUM: { title: 'Sur le podium', text: 'Finis dans le top 3 d’un quiz en groupe', icon: 'trophy' },
  LEVEL_10: { title: 'Niveau 10', text: 'Atteins le niveau {n}', icon: 'shield' },
  LEVEL_25: { title: 'Niveau 25', text: 'Atteins le niveau {n}', icon: 'shield' },
};

/** Ce qu'une partie a rapporte : XP, passage de niveau, badges debloques. */
export interface ProgressGain {
  xp: number;
  levelUp: boolean;
  level: number;
  title: PlayerTitle;
  newBadges: BadgeId[];
  missionsDone: MissionId[];
}

export function progressGain(before: Progress | null, after: Progress | null): ProgressGain | null {
  if (!before || !after) {
    return null;
  }
  const had = new Set(before.badges.filter((b) => b.achieved).map((b) => b.id));
  const done = new Set(before.missions.filter((m) => m.done).map((m) => m.id));
  return {
    xp: Math.max(0, after.totalXp - before.totalXp),
    levelUp: after.level > before.level,
    level: after.level,
    title: after.title,
    newBadges: after.badges.filter((b) => b.achieved && !had.has(b.id)).map((b) => b.id),
    missionsDone: after.missions.filter((m) => m.done && !done.has(m.id)).map((m) => m.id),
  };
}

/** Etoiles d'une partie : 1 des 30 %, 2 des 60 %, 3 pour un sans-faute. */
export function starsFor(correct: number, total: number): number {
  if (!total || !correct) {
    return 0;
  }
  const ratio = correct / total;
  return ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
}
