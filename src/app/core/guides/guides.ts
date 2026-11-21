/*
 * Tutoriels interactifs de l'app (driver.js), affiches par GuideService.
 *
 * Une etape vise un element marque `data-guide="<element>"` dans un template ; `route`
 * ouvre d'abord cet ecran (les etapes suivantes restent sur le meme ecran tant
 * qu'elles n'en donnent pas un autre). Sans element, ou si l'element n'est pas
 * affiche (pas de quiz ouvert...), l'explication apparait au centre de l'ecran ; une
 * etape `optional` (fonction coupee dans le back-office) est sautee.
 *
 * Textes en francais : traduits en kreyol par core/i18n-ht.ts, comme le reste de l'app.
 * Les boutons cites entre « » sont ceux de l'ecran, en francais ici.
 */

export type GuideId = 'demarrage' | 'recharger' | 'retirer' | 'jouer' | 'compte';

export interface GuideStep {
  route?: string;
  /**
   * Avec `route` : l'ecran signale par `data-guide-ready="<ready>"` qu'il a fini de
   * charger ce qui decide de l'affichage (options actives ou non).
   */
  ready?: string;
  element?: string;
  /**
   * Fonction qui peut etre coupee dans le back-office ou indisponible pour ce joueur :
   * sans son element a l'ecran, l'etape est sautee (au lieu d'une explication au centre).
   */
  optional?: boolean;
  title: string;
  text: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export interface Guide {
  id: GuideId;
  icon: string;
  title: string;
  summary: string;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = [
  {
    id: 'demarrage',
    icon: 'flame',
    title: 'Découvrir RAF',
    summary: 'Le tour de l’app en une minute : soldes, onglets et façons de jouer.',
    steps: [
      {
        route: '/accueil',
        title: 'Bienvenue dans RAF !',
        text: 'Voici une visite rapide de l’app. Tu peux la quitter à tout moment avec la croix.',
      },
      {
        element: 'credits',
        title: 'Tes crédits',
        text: 'Ils servent à acheter des tickets et à jouer en Solo. Touche ici pour ouvrir ton Trésor et recharger.',
        side: 'bottom',
      },
      {
        element: 'gains',
        title: 'Tes gains',
        text: 'Ce que tu gagnes, en gourdes. Tu peux les retirer vers MonCash, NatCash ou en espèces au guichet.',
        side: 'bottom',
      },
      {
        element: 'home-tabs',
        title: 'Trois façons de suivre RAF',
        text: 'Actualité : les nouvelles et tes statistiques. En groupe : les quiz avec classement. Solo : un sans-faute et tu gagnes le prix.',
        side: 'bottom',
      },
      {
        element: 'tab-tickets',
        title: 'Tes tickets',
        text: 'Les tickets que tu as pris, ceux à jouer en premier.',
        side: 'top',
      },
      {
        element: 'tab-tresor',
        title: 'Le Trésor',
        text: 'Tes soldes, tes recharges, tes retraits et tout l’historique de ton argent.',
        side: 'top',
      },
      {
        element: 'tab-alertes',
        title: 'Les alertes',
        text: 'Début des quiz, résultats, gains, retraits : tout ce que RAF t’annonce.',
        side: 'top',
      },
      {
        element: 'tab-profil',
        title: 'Ton profil',
        text: 'Ton compte, la langue de l’app, et les Guides si tu as besoin d’aide.',
        side: 'top',
      },
      {
        title: 'À toi de jouer !',
        text: 'Pense à confirmer ton email : c’est nécessaire pour prendre un ticket. Tu retrouveras ce guide et les autres dans Profil, « Aide et support ».',
      },
    ],
  },
  {
    id: 'recharger',
    icon: 'coin',
    title: 'Recharger mes crédits',
    summary: 'En ligne, à distance, au guichet ou avec tes gains.',
    steps: [
      {
        route: '/portefeuille',
        element: 'wallet-credits',
        title: 'Tes crédits de jeu',
        text: 'Ton solde de crédits. Un crédit vaut le nombre de gourdes affiché ici.',
        side: 'bottom',
      },
      {
        element: 'wallet-topup',
        title: 'Recharger',
        text: 'Touche « Recharger » pour voir toutes les façons d’ajouter des crédits.',
        side: 'top',
      },
      {
        route: '/portefeuille/recharger',
        ready: 'topup',
        element: 'topup-online',
        optional: true,
        title: 'Payer en ligne',
        text: 'Paie par MonCash ou NatCash : tes crédits arrivent tout de suite, sans agent. Des frais de paiement s’ajoutent au montant.',
        side: 'bottom',
      },
      {
        element: 'topup-winnings',
        optional: true,
        title: 'Avec tes gains',
        text: 'Tu as des gains ? Transforme-les en crédits sans attendre.',
        side: 'bottom',
      },
      {
        element: 'topup-remote',
        optional: true,
        title: 'À distance',
        text: 'Envoie l’argent au numéro de l’agent RAF, depuis le numéro de ton compte. L’agent crédite ton compte du montant reçu.',
        side: 'bottom',
      },
      {
        element: 'topup-counter',
        title: 'Au guichet',
        text: 'Chez un agent RAF, donne ton numéro de téléphone ou ton identifiant joueur et paie en espèces.',
        side: 'top',
      },
      {
        title: 'Et après ?',
        text: 'Tu reçois une notification dès que tes crédits arrivent. Tes recharges sont listées en bas de cet écran.',
      },
    ],
  },
  {
    id: 'retirer',
    icon: 'bank',
    title: 'Retirer mes gains',
    summary: 'Vers MonCash, NatCash ou en espèces, confirmé par un code.',
    steps: [
      {
        route: '/portefeuille',
        element: 'wallet-winnings',
        title: 'Tes gains',
        text: 'Tes gains en gourdes : c’est ce solde qui se retire. Les crédits, eux, servent seulement à jouer.',
        side: 'bottom',
      },
      {
        element: 'wallet-withdrawals',
        title: 'Suivre tes retraits',
        text: 'Ici, l’état de chaque demande : en attente, approuvée, versée.',
        side: 'top',
      },
      {
        element: 'wallet-withdraw',
        title: 'Retirer',
        text: 'Touche « Retirer » pour faire une demande.',
        side: 'top',
      },
      {
        route: '/portefeuille/retirer',
        element: 'withdraw-amount',
        title: 'Le montant',
        text: 'Saisis le montant à retirer, ou choisis 25 %, 50 % ou tout. Les frais sont indiqués juste dessous.',
        side: 'bottom',
      },
      {
        element: 'withdraw-providers',
        title: 'Où recevoir l’argent',
        text: 'MonCash ou NatCash : indique le numéro de réception. Espèces : présente-toi au guichet RAF une fois la demande approuvée.',
        side: 'top',
      },
      {
        element: 'withdraw-send',
        title: 'Le code de confirmation',
        text: 'Touche ici pour recevoir un code, puis saisis-le pour envoyer ta demande. Ne donne jamais ce code à personne, sauf à l’agent au guichet.',
        side: 'top',
      },
      {
        title: 'Et après ?',
        text: 'L’équipe RAF valide ta demande, puis l’argent est versé. Tu es prévenu à chaque étape. Tu dois avoir vérifié ton téléphone avant ton premier retrait.',
      },
    ],
  },
  {
    id: 'jouer',
    icon: 'trophy',
    title: 'Jouer un quiz',
    summary: 'En groupe avec un ticket, ou en Solo pour un sans-faute.',
    steps: [
      {
        route: '/accueil?onglet=groupe',
        element: 'home-tabs',
        title: 'Les quiz en groupe',
        text: 'Dans l’onglet « En groupe », tous les joueurs d’un quiz s’affrontent : les mieux classés se partagent les récompenses.',
        side: 'bottom',
      },
      {
        element: 'quiz-card',
        title: 'Un quiz',
        text: 'Touche un quiz pour voir ses récompenses et ses règles, puis prends ton ticket. Un ticket = une partie ; seule ta meilleure partie compte.',
        side: 'bottom',
      },
      {
        route: '/accueil?onglet=solo',
        element: 'solo-how',
        title: 'Le mode Solo',
        text: 'Tu paies ta partie en crédits et tu joues tout de suite. Toutes les réponses justes : le prix est à toi, versé aussitôt.',
        side: 'bottom',
      },
      {
        title: 'Pendant la partie',
        text: 'Chaque question a son chrono : réponds avant la fin. Pas de retour en arrière, et l’app ne dit pas si ta réponse est juste avant la fin du quiz.',
      },
      {
        route: '/tickets',
        element: 'tab-tickets',
        title: 'Tes tickets',
        text: 'Retrouve ici les quiz où tu as un ticket à jouer, et ton historique.',
        side: 'top',
      },
    ],
  },
  {
    id: 'compte',
    icon: 'shield',
    title: 'Mon compte et ma sécurité',
    summary: 'Email, téléphone, notifications, langue et invitations.',
    steps: [
      {
        route: '/profil',
        element: 'profile-account',
        title: 'Email et téléphone',
        text: 'Confirme ton email (pour prendre un ticket) et vérifie ton téléphone (pour retirer tes gains). Tu peux corriger une adresse ou un numéro mal saisi.',
        side: 'bottom',
      },
      {
        element: 'profile-invite',
        title: 'Inviter un ami',
        text: 'Partage ton lien ou ton code QR : ton ami s’inscrit avec toi comme parrain.',
        side: 'bottom',
      },
      {
        element: 'profile-lang',
        title: 'La langue',
        text: 'Choisis Français ou Kreyòl : toute l’app change de langue.',
        side: 'bottom',
      },
      {
        element: 'profile-notifications',
        title: 'Les notifications',
        text: 'Choisis ce que tu veux recevoir, par email ou en notification sur ton téléphone.',
        side: 'top',
      },
      {
        element: 'profile-devices',
        title: 'Appareils connectés',
        text: 'Un appareil inconnu ? Déconnecte-le, puis change ton mot de passe. Ne donne jamais ton mot de passe ni tes codes à personne.',
        side: 'top',
      },
    ],
  },
];
