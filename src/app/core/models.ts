// Formes des reponses de l'API RAF (cote joueur). Les dates arrivent en ISO-8601.

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: { field: string; message: string }[] | null;
}

// --- Compte ---------------------------------------------------------------------

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface User {
  id: number;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Compte de test : joue gratuitement et sans limite, ne gagne rien. */
  test?: boolean;
  roles: string[];
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface DeviceSession {
  id: number;
  deviceLabel: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Joueur dont le lien d'invitation a ete suivi (parametre « parrain »). */
  inviterId?: number;
}

/** Lien d'invitation du joueur ; un leader offre un bonus a ses filleuls. */
export interface Invite {
  url: string;
  leader: boolean;
  signupBonusCredits: number;
}

// --- Quiz -----------------------------------------------------------------------

export type QuizStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'CLOSING'
  | 'COMPUTING'
  | 'FINISHED'
  | 'CANCELLED';

/** En groupe (tickets, classement) ou Solo (partie payee, prix pour un sans-faute). */
export type GameMode = 'GROUP' | 'SOLO';

/**
 * BATCH : tout le tirage au demarrage, reponses envoyees d'un bloc a la fin.
 * SEQUENTIAL : une question a la fois, chaque reponse envoyee aussitot.
 */
export type PlayMode = 'BATCH' | 'SEQUENTIAL';

export interface Reward {
  rankFrom: number;
  rankTo: number;
  /** Par joueur de la tranche, en HTG. */
  amountHtg: number;
  label: string | null;
}

export interface Topic {
  id: number;
  categoryId: number;
  label: string;
  imageUrl: string | null;
  voteCount: number;
}

export interface Quiz {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  themeLabel: string | null;
  bannerUrl: string | null;
  status: QuizStatus;
  gameMode: GameMode;
  topicMode: 'ADMIN' | 'VOTE';
  selectedCategoryId: number | null;
  selectedCategoryName: string | null;
  ticketPriceCredits: number;
  ticketPriceHtg: number;
  /** Ticket ou partie offerts (prix a 0) : un seul ticket par joueur en groupe. */
  free: boolean;
  minPlayers: number;
  maxTicketsTotal: number | null;
  maxTicketsPerPlayer: number | null;
  playMode: PlayMode;
  /** Chrono de chaque question. */
  questionDurationSeconds: number;
  questionsPerGame: number;
  pointsPerCorrect: number;
  /** Solo : prix d'un sans-faute, en HTG (ticketPrice* = prix d'une partie). */
  soloPrizeHtg: number | null;
  minScoreThreshold: number;
  closingCountdownMinutes: number;
  startDelayMinutes: number;
  voteOpensAt: string | null;
  voteClosesAt: string | null;
  voteOpen: boolean;
  thresholdReachedAt: string | null;
  scheduledStartAt: string | null;
  startedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  cancellationReason: string | null;
  playersRegistered: number;
  ticketsSold: number;
  poolSize: number;
  rewards: Reward[];
  topics: Topic[];
}

export type TicketStatus = 'ACTIVE' | 'USED' | 'REFUNDED';

export interface Ticket {
  id: number;
  quizId: number;
  quizTitle: string;
  quizStatus: QuizStatus;
  code: string;
  pricePaidCredits: number;
  status: TicketStatus;
  purchasedAt: string;
  usedAt: string | null;
}

// --- Jeu ------------------------------------------------------------------------

export interface GameChoice {
  id: number;
  text: string;
  imageUrl: string | null;
}

export interface GameQuestion {
  id: number;
  position: number;
  text: string;
  imageUrl: string | null;
  type: 'SINGLE_CHOICE' | 'TRUE_FALSE';
  choices: GameChoice[];
}

/** SEQUENTIAL : la question a jouer et le temps qu'il lui reste, calcule par le serveur. */
export interface CurrentQuestion {
  question: GameQuestion;
  endsAt: string;
  remainingMs: number;
}

export interface GameStart {
  sessionId: number;
  quizId: number;
  resumed: boolean;
  playMode: PlayMode;
  questionDurationSeconds: number;
  totalQuestions: number;
  durationSeconds: number;
  startedAt: string;
  playEndsAt: string;
  remainingMs: number;
  /** BATCH : tout le tirage. SEQUENTIAL : vide. */
  questions: GameQuestion[];
  /** SEQUENTIAL : la question en cours. BATCH : null. */
  current: CurrentQuestion | null;
}

/** BATCH : reponse envoyee au submit. choiceId null : chrono de la question expire. */
export interface GameAnswer {
  questionId: number;
  choiceId: number | null;
  elapsedMs: number;
}

/** SEQUENTIAL : suite de la partie apres une reponse. */
export interface GameTurn {
  sessionId: number;
  /** false : reponse arrivee hors delai (comptee sans reponse) ou envoi rejoue. */
  accepted: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  next: CurrentQuestion | null;
  result: GameResult | null;
}

export type GameSessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'INVALIDATED';

export interface GameResult {
  sessionId: number;
  quizId: number;
  status: GameSessionStatus;
  gameMode: GameMode;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  correctCount: number | null;
  answeredCount: number | null;
  bestScore: number | null;
  /** Solo : sans-faute, prix verse. */
  won: boolean;
  prizeHtg: number | null;
}

/** Resultat d'une question au corrige : jamais l'enonce ni la bonne reponse. */
export type OutcomeResult = 'CORRECT' | 'WRONG' | 'UNANSWERED';

export interface Outcome {
  position: number;
  result: OutcomeResult;
}

/**
 * Corrige d'une partie, visible a la fin du quiz : juste, fausse ou sans reponse
 * par question. Les questions et leurs reponses restent preservees.
 */
export interface GameOutcome {
  sessionId: number;
  quizId: number;
  status: GameSessionStatus;
  score: number | null;
  correctCount: number | null;
  answeredCount: number | null;
  items: Outcome[];
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  rewardHtg: number;
  me: boolean;
}

export interface Leaderboard {
  quizId: number;
  quizTitle: string;
  finishedAt: string | null;
  totalRanked: number;
  page: number;
  size: number;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

// --- Portefeuille ---------------------------------------------------------------

/** Solde de jeu en credits ; solde de gains (retirable) directement en HTG. */
export interface Wallet {
  creditBalance: number;
  creditBalanceHtg: number;
  winningsBalanceHtg: number;
  htgRate: number;
}

export type TransactionType =
  | 'TOPUP'
  | 'TICKET_PURCHASE'
  | 'SOLO_ENTRY'
  | 'PRIZE'
  /** Commission d'un leader sur les parties perdues de ses joueurs (solde des gains). */
  | 'COMMISSION'
  /** Bonus offert a l'inscription avec le lien d'un leader (solde des credits). */
  | 'INVITE_BONUS'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface Transaction {
  id: number;
  type: TransactionType;
  balanceType: 'CREDIT' | 'WINNINGS';
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export type PaymentProvider = 'MONCASH' | 'NATCASH' | 'MANUAL';

export interface TopUp {
  id: number;
  provider: PaymentProvider;
  amountHtg: number;
  credits: number;
  status: string;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/** Un agent est-il en ligne pour crediter les recharges ? `lastSeenAt` seulement hors ligne. */
export interface TopUpAvailability {
  available: boolean;
  lastSeenAt?: string;
}

/** Numeros de l'agent pour les recharges a distance (+509XXXXXXXX), absents si desactives. */
export interface DepositNumbers {
  moncashNumber?: string | null;
  natcashNumber?: string | null;
}

export type WithdrawalStatus = 'AWAITING_OTP' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';

export interface Withdrawal {
  id: number;
  amountHtg: number;
  feeHtg: number;
  netHtg: number;
  provider: PaymentProvider;
  destinationNumber: string | null;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  payoutReference: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  initiatedByAdminId: number | null;
  note: string | null;
}

export interface WithdrawalRequest {
  /** Retire des gains, frais compris. */
  amountHtg: number;
  provider: PaymentProvider;
  destinationNumber: string | null;
  otpCode: string;
}

// --- Notifications ----------------------------------------------------------------

export type NotificationType =
  | 'QUIZ_SCHEDULED'
  | 'QUIZ_STARTED'
  | 'QUIZ_CLOSING'
  | 'QUIZ_CANCELLED'
  | 'QUIZ_RESULTS'
  | 'PRIZE_WON'
  | 'TOPUP_CONFIRMED'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_PAID'
  | 'WITHDRAWAL_REJECTED'
  | 'ANNOUNCEMENT'
  | 'ADMIN_RECONCILIATION_ALERT';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  data: string | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
  /** Message de l'equipe a acquitter par « J'ai compris ». */
  popup: boolean;
  acknowledgedAt: string | null;
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH';

export interface NotificationPreference {
  type: NotificationType;
  description: string;
  channel: NotificationChannel;
  enabled: boolean;
  enabledByDefault: boolean;
}
