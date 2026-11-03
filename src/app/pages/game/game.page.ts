import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonRouterOutlet, NavController, Platform } from '@ionic/angular/standalone';
import { Subscription, firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorCode, errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { CurrentQuestion, GameAnswer, GameQuestion, GameResult, GameStart, GameTurn, Quiz } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { SoundService } from '../../core/sound.service';
import { storage } from '../../core/storage';
import { IconComponent } from '../../ui/icon.component';
import { InstagramCardComponent } from '../../ui/instagram-card.component';
import { closeModal } from '../../ui/modal';
import { NumPipe } from '../../ui/pipes';

type Phase = 'loading' | 'intro' | 'countdown' | 'starting' | 'playing' | 'submitting' | 'result' | 'failed';

interface SavedGame {
  sessionId: number;
  answers: GameAnswer[];
}

/** SEQUENTIAL : reponse en cours d'envoi, renvoyee telle quelle si le reseau a lache. */
interface PendingAnswer {
  questionId: number;
  choiceId: number | null;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
/** Delai entre le toucher d'une reponse et la question suivante. */
const NEXT_DELAY_MS = 420;
/** Duree du bandeau « Temps écoulé » quand une question expire. */
const MISSED_FLASH_MS = 700;

/*
 * Ecran de jeu.
 *
 * Revelation differee (voir docs/ARCHITECTURE.md du backend) : rien n'indique si
 * une reponse est juste. Le score n'est connu qu'a la fin de la partie.
 *
 * Chaque question a son propre chrono : on passe a la suivante des la reponse,
 * ou a l'expiration (la question compte alors sans reponse). Deux deroulements,
 * choisis par le quiz :
 *
 *  - BATCH : tout le tirage arrive au demarrage et la partie se joue sans reseau.
 *    Le chrono de reference est celui du serveur (remainingMs au demarrage) ;
 *    l'horloge de l'appareil ne mesure que le temps ecoule depuis. Une question
 *    commence quand la precedente se termine : chaque reponse porte son elapsedMs
 *    depuis le debut de la partie, et l'ecart entre deux reponses ne depasse
 *    jamais le chrono. Les reponses sont gardees sur l'appareil : si
 *    l'application est fermee, la partie reprend ou elle en etait, les questions
 *    expirees entre-temps comptant sans reponse.
 *  - SEQUENTIAL : une question a la fois. Chaque reponse part aussitot et le
 *    serveur renvoie la suivante avec son temps restant. Il n'y a rien a garder
 *    sur l'appareil : la reprise est geree par le serveur.
 *
 * Mode Solo : pas de ticket, la partie est payee au lancement et un sans-faute
 * rapporte le prix du quiz. Toujours SEQUENTIAL.
 */
@Component({
  selector: 'raf-game',
  imports: [IonContent, IonIcon, IonModal, IconComponent, InstagramCardComponent, NumPipe],
  templateUrl: './game.page.html',
  styleUrl: './game.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePage implements OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);
  private readonly sound = inject(SoundService);
  protected readonly state = inject(PlayerStateService);
  private readonly auth = inject(AuthService);
  /** Compte de test : parties offertes, sans limite d'une par jour, sans gain. */
  protected readonly isTester = computed(() => !!this.auth.user()?.test);
  private readonly platform = inject(Platform);
  private readonly outlet = inject(IonRouterOutlet, { optional: true });

  protected readonly quizId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly letters = LETTERS;

  protected readonly phase = signal<Phase>('loading');
  protected readonly quiz = signal<Quiz | null>(null);
  protected readonly activeTickets = signal(0);
  protected readonly hasOngoing = signal(false);
  /** Solo : sujet deja joue aujourd'hui. */
  protected readonly playedToday = signal(false);
  protected readonly countdown = signal(3);
  protected readonly error = signal<string | null>(null);
  protected readonly quitOpen = signal(false);

  protected readonly game = signal<GameStart | null>(null);
  /** Question affichee et sa position (0 = premiere). */
  protected readonly question = signal<GameQuestion | null>(null);
  protected readonly index = signal(0);
  protected readonly picked = signal<number | null>(null);
  /** Bandeau « Temps écoulé » apres une question expiree. */
  protected readonly missed = signal(false);
  protected readonly questionRemainingMs = signal(0);
  protected readonly result = signal<GameResult | null>(null);
  protected readonly previousBest = signal<number | null>(null);
  protected readonly shownScore = signal(0);

  private readonly content = viewChild(IonContent);
  private readonly quitModal = viewChild(IonModal);

  /**
   * Une question longue ou illustree peut depasser l'ecran : la page defile, et
   * chaque nouvelle question repart du haut (enonce visible avant les choix).
   */
  private readonly scrollOnQuestion = effect(() => {
    if (this.question()) {
      void this.content()?.scrollToTop(0);
    }
  });

  protected readonly solo = computed(() => this.quiz()?.gameMode === 'SOLO');
  protected readonly total = computed(() => this.game()?.totalQuestions ?? this.quiz()?.questionsPerGame ?? 0);
  private readonly questionDurationMs = computed(
    () => (this.game()?.questionDurationSeconds ?? this.quiz()?.questionDurationSeconds ?? 1) * 1000,
  );
  protected readonly seconds = computed(() => Math.ceil(this.questionRemainingMs() / 1000));
  protected readonly timeRatio = computed(() =>
    Math.max(0, Math.min(1, this.questionRemainingMs() / this.questionDurationMs())),
  );
  protected readonly hurry = computed(
    () =>
      this.phase() === 'playing' &&
      this.questionRemainingMs() <= Math.min(3_000, this.questionDurationMs() * 0.4),
  );
  protected readonly canAfford = computed(() => {
    const wallet = this.state.wallet();
    const quiz = this.quiz();
    return this.isTester() || (!!wallet && !!quiz && wallet.creditBalance >= quiz.ticketPriceCredits);
  });
  protected readonly stars = computed(() => {
    const r = this.result();
    if (!r || !r.correctCount || !this.total()) {
      return 0;
    }
    const ratio = r.correctCount / this.total();
    return ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
  });
  protected readonly newRecord = computed(() => {
    const r = this.result();
    const before = this.previousBest();
    return !this.solo() && !!r && r.score != null && before != null && r.score > before;
  });

  // BATCH : reponses donnees et chrono de reference.
  private answers: GameAnswer[] = [];
  /** Temps serveur ecoule au moment ou la reponse /start est arrivee. */
  private baseElapsedMs = 0;
  private receivedAt = 0;
  private durationMs = 0;
  /** Debut de la question en cours, en temps ecoule depuis le debut de la partie. */
  private questionStartMs = 0;

  // SEQUENTIAL : fin du chrono de la question en cours, en horloge de l'appareil.
  private questionEndsAt = 0;
  private pending: PendingAnswer | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  /** Derniere seconde ayant joue le tic de fin de chrono. */
  private lastTickSecond = -1;
  private backButton: Subscription | null = null;

  ionViewWillEnter(): void {
    if (this.phase() === 'loading') {
      void this.prepare();
    }
  }

  ionViewDidEnter(): void {
    // Pendant la partie, pas de retour par balayage ni par le bouton Android.
    if (this.outlet) {
      this.outlet.swipeGesture = false;
    }
    this.backButton = this.platform.backButton.subscribeWithPriority(100, () => this.askQuit());
  }

  ionViewWillLeave(): void {
    if (this.outlet) {
      this.outlet.swipeGesture = true;
    }
    this.backButton?.unsubscribe();
    void closeModal(this.quitOpen, this.quitModal());
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.backButton?.unsubscribe();
  }

  // --- Avant la partie -------------------------------------------------------------

  private async prepare(): Promise<void> {
    try {
      const [quiz, sessions] = await Promise.all([
        firstValueFrom(this.apiService.quiz(this.quizId)),
        firstValueFrom(this.apiService.mySessions(this.quizId)),
      ]);
      this.quiz.set(quiz);
      this.hasOngoing.set(sessions.some((s) => s.status === 'IN_PROGRESS'));

      if (quiz.gameMode === 'SOLO') {
        const [played] = await Promise.all([
          firstValueFrom(this.apiService.soloPlayedToday()),
          this.state.refreshWallet(),
        ]);
        this.playedToday.set(quiz.selectedCategoryId != null && played.includes(quiz.selectedCategoryId));
      } else {
        const tickets = await firstValueFrom(this.apiService.quizTickets(this.quizId));
        this.activeTickets.set(tickets.filter((t) => t.status === 'ACTIVE').length);
        const scores = sessions.filter((s) => s.status === 'SUBMITTED').map((s) => s.score ?? 0);
        this.previousBest.set(scores.length ? Math.max(...scores) : null);
      }
      this.phase.set('intro');
    } catch (e) {
      this.fail(errorMessage(e));
    }
  }

  protected launch(): void {
    this.feedback.tap();
    if (this.hasOngoing()) {
      void this.begin();
      return;
    }
    // 3, 2, 1 : le chrono serveur ne demarre qu'a l'appel de /start, apres le decompte.
    this.phase.set('countdown');
    this.countdown.set(3);
    this.sound.play('count');
    const tick = setInterval(() => {
      const next = this.countdown() - 1;
      this.feedback.tap(next <= 0 ? 'go' : 'count');
      if (next <= 0) {
        clearInterval(tick);
        void this.begin();
      } else {
        this.countdown.set(next);
      }
    }, 800);
  }

  private async begin(): Promise<void> {
    this.phase.set('starting');
    try {
      const game = await firstValueFrom(this.apiService.startGame(this.quizId));
      this.game.set(game);
      void this.state.refreshWallet();

      if (game.playMode === 'SEQUENTIAL') {
        this.showCurrent(game.current);
      } else {
        await this.beginBatch(game);
      }
      if (game.resumed && this.phase() === 'playing') {
        void this.feedback.toast('Partie reprise : les questions expirées entre-temps comptent sans réponse.');
      }
    } catch (e) {
      this.fail(errorMessage(e), errorCode(e));
    }
  }

  // --- BATCH -------------------------------------------------------------------------

  private async beginBatch(game: GameStart): Promise<void> {
    this.receivedAt = performance.now();
    this.durationMs = game.durationSeconds * 1000;
    this.baseElapsedMs = Math.max(0, this.durationMs - game.remainingMs);

    const saved = await storage.getJson<SavedGame>(this.storageKey(game.sessionId));
    this.answers = game.resumed && saved?.sessionId === game.sessionId ? this.validPrefix(game, saved.answers) : [];
    this.questionStartMs = this.answers[this.answers.length - 1]?.elapsedMs ?? 0;

    this.catchUp();
    if (this.answers.length >= game.questions.length || game.remainingMs <= 0) {
      await this.submit();
      return;
    }
    this.showBatchQuestion();
    this.phase.set('playing');
    this.startTimer();
  }

  /** Reponses sauvegardees qui correspondent bien, dans l'ordre, aux questions de la partie. */
  private validPrefix(game: GameStart, saved: GameAnswer[]): GameAnswer[] {
    const valid: GameAnswer[] = [];
    for (let i = 0; i < saved.length && i < game.questions.length; i++) {
      const question = game.questions[i];
      const answer = saved[i];
      if (answer.questionId !== question.id) {
        break;
      }
      if (answer.choiceId !== null && !question.choices.some((c) => c.id === answer.choiceId)) {
        break;
      }
      valid.push(answer);
    }
    return valid;
  }

  /**
   * Questions expirees pendant une absence : chacune compte sans reponse, a
   * l'instant ou son chrono s'est termine.
   */
  private catchUp(): void {
    const game = this.game();
    if (!game) {
      return;
    }
    const duration = this.questionDurationMs();
    let changed = false;
    while (this.answers.length < game.questions.length && this.elapsedNow() >= this.questionStartMs + duration) {
      this.questionStartMs += duration;
      this.answers.push({ questionId: game.questions[this.answers.length].id, choiceId: null, elapsedMs: this.questionStartMs });
      changed = true;
    }
    if (changed) {
      this.save();
    }
  }

  private showBatchQuestion(): void {
    const game = this.game();
    const i = this.answers.length;
    this.index.set(i);
    this.question.set(game?.questions[i] ?? null);
    this.questionRemainingMs.set(Math.max(0, this.questionStartMs + this.questionDurationMs() - this.elapsedNow()));
  }

  /** Enregistre la reponse (ou l'absence de reponse) a la question en cours et passe a la suivante. */
  private recordBatch(choiceId: number | null): void {
    const game = this.game();
    const question = this.question();
    if (!game || !question) {
      return;
    }
    const end = this.questionStartMs + this.questionDurationMs();
    const elapsedMs =
      choiceId === null ? end : Math.round(Math.min(end, Math.max(this.questionStartMs, this.elapsedNow())));
    this.answers.push({ questionId: question.id, choiceId, elapsedMs });
    this.questionStartMs = elapsedMs;
    this.save();

    if (this.answers.length >= game.questions.length) {
      void this.submit();
    } else {
      this.showBatchQuestion();
    }
  }

  /** Temps ecoule depuis le debut de la partie, vu du serveur. */
  private elapsedNow(): number {
    return this.baseElapsedMs + (performance.now() - this.receivedAt);
  }

  private save(): void {
    const game = this.game();
    if (game) {
      void storage.setJson(this.storageKey(game.sessionId), {
        sessionId: game.sessionId,
        answers: this.answers,
      } satisfies SavedGame);
    }
  }

  // --- SEQUENTIAL --------------------------------------------------------------------

  private showCurrent(current: CurrentQuestion | null): void {
    if (!current) {
      // Partie deja terminee cote serveur (reprise apres la derniere reponse).
      void this.nav.navigateBack(this.backUrl());
      return;
    }
    this.question.set(current.question);
    this.index.set(current.question.position - 1);
    this.questionEndsAt = performance.now() + current.remainingMs;
    this.questionRemainingMs.set(current.remainingMs);
    this.phase.set('playing');
    this.startTimer();
  }

  private async sendAnswer(answer: PendingAnswer): Promise<void> {
    const game = this.game();
    if (!game) {
      return;
    }
    this.pending = answer;
    try {
      const turn = await firstValueFrom(this.apiService.answerQuestion(game.sessionId, answer.questionId, answer.choiceId));
      this.pending = null;
      this.onTurn(turn, answer);
    } catch (e) {
      this.fail(errorMessage(e), errorCode(e));
    }
  }

  private onTurn(turn: GameTurn, sent: PendingAnswer): void {
    if (sent.choiceId !== null && !turn.accepted) {
      void this.feedback.toast('Trop tard : cette réponse n\'a pas été retenue.');
    }
    this.picked.set(null);
    if (turn.result) {
      this.showResult(turn.result);
    } else {
      this.showCurrent(turn.next);
    }
  }

  // --- Chrono et reponses ------------------------------------------------------------

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), 100);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (this.phase() !== 'playing' || this.picked() !== null) {
      return;
    }
    const remaining =
      this.game()?.playMode === 'SEQUENTIAL'
        ? this.questionEndsAt - performance.now()
        : this.questionStartMs + this.questionDurationMs() - this.elapsedNow();
    this.questionRemainingMs.set(Math.max(0, remaining));
    // Tic a chaque seconde de la fin du chrono (bandeau rouge « hurry »).
    if (this.hurry() && this.seconds() !== this.lastTickSecond && remaining > 0) {
      this.lastTickSecond = this.seconds();
      this.sound.play('tick');
    }
    if (remaining <= 0) {
      this.expire();
    }
  }

  /** Chrono de la question ecoule : elle compte sans reponse. */
  private expire(): void {
    const question = this.question();
    if (!question) {
      return;
    }
    void this.feedback.buzz('warning');
    this.sound.play('timeout');
    this.missed.set(true);
    setTimeout(() => this.missed.set(false), MISSED_FLASH_MS);

    if (this.game()?.playMode === 'SEQUENTIAL') {
      // Pas de choix possible pendant l'envoi : -1 ne correspond a aucune proposition.
      this.picked.set(-1);
      void this.sendAnswer({ questionId: question.id, choiceId: null });
    } else {
      this.recordBatch(null);
    }
  }

  protected choose(choiceId: number): void {
    const question = this.question();
    if (!question || this.phase() !== 'playing' || this.picked() !== null) {
      return;
    }
    // Son neutre : la reponse est enregistree, sans dire si elle est juste (revelation differee).
    this.feedback.tap('answer');
    this.picked.set(choiceId);

    if (this.game()?.playMode === 'SEQUENTIAL') {
      // Le serveur horodate a la reception : on envoie tout de suite, l'animation
      // tourne pendant l'aller-retour.
      void this.sendAnswer({ questionId: question.id, choiceId });
      return;
    }
    setTimeout(() => {
      this.picked.set(null);
      this.recordBatch(choiceId);
    }, NEXT_DELAY_MS);
  }

  // --- Fin de partie -----------------------------------------------------------------

  /** BATCH : envoie toutes les reponses. */
  protected async submit(): Promise<void> {
    const game = this.game();
    if (!game) {
      return;
    }
    this.stopTimer();
    this.phase.set('submitting');
    this.error.set(null);
    const clientDurationMs = Math.round(Math.min(this.durationMs, this.elapsedNow()));
    try {
      const result = await firstValueFrom(this.apiService.submitGame(game.sessionId, this.answers, clientDurationMs));
      await storage.remove(this.storageKey(game.sessionId));
      this.showResult(result);
    } catch (e) {
      const code = errorCode(e);
      if (code === 'GAME_SESSION_CLOSED' || code === 'GAME_TIME_EXPIRED') {
        await storage.remove(this.storageKey(game.sessionId));
      }
      this.fail(errorMessage(e), code);
    }
  }

  private showResult(result: GameResult): void {
    this.stopTimer();
    this.result.set(result);
    this.phase.set('result');
    const lost = result.gameMode === 'SOLO' && !result.won;
    void this.feedback.buzz(lost ? 'warning' : 'success');
    this.sound.play(lost ? 'lose' : 'win');
    this.animateScore(result.score ?? 0);
    void this.state.refreshWallet();
    if (result.gameMode !== 'SOLO') {
      void this.refreshTickets();
    }
  }

  private animateScore(target: number): void {
    const steps = 24;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      this.shownScore.set(Math.round((target * step) / steps));
      if (step >= steps) {
        clearInterval(timer);
      }
    }, 40);
  }

  private async refreshTickets(): Promise<void> {
    try {
      const tickets = await firstValueFrom(this.apiService.quizTickets(this.quizId));
      this.activeTickets.set(tickets.filter((t) => t.status === 'ACTIVE').length);
    } catch {
      this.activeTickets.set(0);
    }
  }

  // --- Sortie ------------------------------------------------------------------------

  protected askQuit(): void {
    const phase = this.phase();
    if (phase === 'playing' || phase === 'countdown' || phase === 'starting') {
      this.quitOpen.set(true);
    } else if (phase !== 'submitting') {
      this.leave();
    }
  }

  protected async leave(): Promise<void> {
    this.stopTimer();
    await closeModal(this.quitOpen, this.quitModal());
    void this.nav.navigateBack(this.backUrl());
  }

  protected async goTopUp(): Promise<void> {
    await closeModal(this.quitOpen, this.quitModal());
    void this.nav.navigateForward('/portefeuille/recharger');
  }

  protected replay(): void {
    this.previousBest.set(Math.max(this.previousBest() ?? 0, this.result()?.score ?? 0));
    this.result.set(null);
    this.game.set(null);
    this.question.set(null);
    this.answers = [];
    this.hasOngoing.set(false);
    if (this.activeTickets() > 0) {
      this.launch();
    } else {
      void this.nav.navigateBack(`/quiz/${this.quizId}`);
    }
  }

  private backUrl(): string {
    return this.solo() ? '/solo' : `/quiz/${this.quizId}`;
  }

  private fail(message: string, code: string | null = null): void {
    this.stopTimer();
    this.error.set(message);
    this.failCode = code;
    this.phase.set('failed');
    void this.feedback.buzz('error');
    this.sound.play('error');
  }

  protected failCode: string | null = null;

  /** Echec passager (reseau) apres le demarrage : les reponses ne sont pas perdues, on peut reessayer. */
  protected canRetry(): boolean {
    return !!this.game() && this.result() === null && (!this.failCode || this.failCode === 'INTERNAL_ERROR');
  }

  protected retry(): void {
    if (this.pending) {
      // SEQUENTIAL : le serveur reconnait un envoi rejoue (meme question).
      this.phase.set('playing');
      void this.sendAnswer(this.pending);
    } else {
      void this.submit();
    }
  }

  protected retryStart(): void {
    this.phase.set('loading');
    this.error.set(null);
    void this.prepare();
  }

  private storageKey(sessionId: number): string {
    return `raf-game-${sessionId}`;
  }
}
