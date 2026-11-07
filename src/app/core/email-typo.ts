/*
 * Detection des fautes de frappe dans une adresse email (« jean@gmial.com »).
 *
 * Beaucoup de joueurs se trompent en tapant leur adresse et ne recoivent jamais
 * le lien de confirmation. On ne bloque rien : on propose la correction la plus
 * probable, le joueur choisit. Une adresse d'un domaine inconnu et eloigne des
 * fournisseurs courants (adresse professionnelle...) n'est jamais signalee.
 */

/** Fournisseurs courants chez les joueurs, du plus frequent au moins frequent (departage les egalites). */
const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.fr',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'icloud.com',
  'live.com',
  'live.fr',
  'msn.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
];

/** Distance de Damerau-Levenshtein (une inversion de deux lettres compte pour une faute). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Nettoyage sans ambiguite : espaces, majuscules, virgules et points en trop, accents. */
function clean(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

/** Vrais domaines proches d'un fournisseur courant (« mail.com » / gmail.com) : jamais corriges. */
const LEGIT_DOMAINS = new Set([
  'mail.com',
  'ymail.com',
  'gmx.com',
  'gmx.fr',
  'me.com',
  'mac.com',
  'yahoo.ca',
  'hotmail.ca',
  'live.ca',
  'outlook.ca',
  'hotmail.co.uk',
  'yahoo.co.uk',
  'orange.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
]);

function closestDomain(domain: string): string | null {
  if (KNOWN_DOMAINS.includes(domain) || LEGIT_DOMAINS.has(domain)) {
    return domain;
  }
  // « gmail » sans extension, ou « gmail.co », « gmail.cm », « gmail.con »...
  const name = domain.split('.')[0];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const known of KNOWN_DOMAINS) {
    const knownName = known.split('.')[0];
    const score = Math.min(
      distance(domain, known),
      // Nom exact, extension fautive ou absente : « gmail.co » -> gmail.com.
      name === knownName ? 1 : Infinity,
    );
    if (score < bestScore) {
      best = known;
      bestScore = score;
    }
  }
  // Une faute pour un domaine court, deux au plus pour un long (« hotmial.com »).
  const tolerated = domain.length >= 9 ? 2 : 1;
  return bestScore <= tolerated ? best : null;
}

/**
 * Adresse corrigee si celle saisie contient probablement une faute, sinon null.
 * Ex. : « Jean @Gmial.com » -> « jean@gmail.com », « jean@yahoo » -> « jean@yahoo.com ».
 */
export function suggestEmail(raw: string): string | null {
  const typed = raw.trim();
  const cleaned = clean(typed);
  const at = cleaned.lastIndexOf('@');
  if (at <= 0 || at === cleaned.length - 1) {
    return null;
  }
  const local = cleaned.slice(0, at).replace(/@/g, '');
  const domain = closestDomain(cleaned.slice(at + 1)) ?? cleaned.slice(at + 1);
  const suggestion = `${local}@${domain}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suggestion)) {
    return null;
  }
  // Une simple difference de majuscules ne merite pas d'interrompre le joueur.
  return suggestion !== typed.toLowerCase() ? suggestion : null;
}
