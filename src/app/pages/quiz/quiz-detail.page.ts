import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ClockService } from '../../core/clock.service';
import { errorCode, errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { formatCountdown } from '../../core/format';
import { GameResult, Quiz, Reward, Ticket } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { uuid } from '../../core/uuid';
import {
  STATUS_LABELS,
  acceptsPlay,
  acceptsTickets,
  rankLabel,
  sortedRewards,
  statusClass,
  statusLine,
  themeGradient,
  totalPrizesHtg,
} from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';
import { InstagramCardComponent } from '../../ui/instagram-card.component';
import { closeModal } from '../../ui/modal';
import { HtgPipe, NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

@Component({
  selector: 'raf-quiz-detail',
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    IonFooter,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    TopBarComponent,
    IconComponent,
    InstagramCardComponent,
    NumPipe,
    HtgPipe,
  ],
  templateUrl: './quiz-detail.page.html',
  styleUrl: './quiz-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizDetailPage {
  private readonly apiService = inject(ApiService);
  protected readonly nav = inject(NavController);
  private readonly clock = inject(ClockService);
  private readonly feedback = inject(FeedbackService);
  protected readonly state = inject(PlayerStateService);
  private readonly auth = inject(AuthService);
  /** Compte de test : tickets offerts, sans limite ni capacite (le serveur applique la meme regle). */
  protected readonly isTester = computed(() => !!this.auth.user()?.test);

  protected readonly quizId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly quiz = signal<Quiz | null>(null);
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly sessions = signal<GameResult[]>([]);
  protected readonly error = signal<string | null>(null);

  // Achat
  protected readonly buyOpen = signal(false);
  private readonly buyModal = viewChild(IonModal);
  protected readonly buying = signal(false);
  protected readonly bought = signal<Ticket | null>(null);
  protected readonly buyError = signal<string | null>(null);
  /** Cle d'idempotence d'un achat : la meme pour chaque nouvel essai du meme achat. */
  private purchaseKey: string | null = null;

  protected readonly voting = signal<number | null>(null);

  protected readonly now = this.clock.now;
  protected readonly activeTickets = computed(() => this.tickets().filter((t) => t.status === 'ACTIVE').length);
  protected readonly ownedTickets = computed(() => this.tickets().filter((t) => t.status !== 'REFUNDED').length);
  protected readonly submitted = computed(() => this.sessions().filter((s) => s.status === 'SUBMITTED'));
  protected readonly inProgress = computed(() => this.sessions().some((s) => s.status === 'IN_PROGRESS'));
  protected readonly bestScore = computed(() => {
    const scores = this.submitted().map((s) => s.score ?? 0);
    return scores.length ? Math.max(...scores) : null;
  });

  protected readonly rewards = computed(() => (this.quiz() ? sortedRewards(this.quiz()!) : []));
  protected readonly totalPrizes = computed(() => (this.quiz() ? totalPrizesHtg(this.quiz()!) : 0));
  protected readonly line = computed(() => (this.quiz() ? statusLine(this.quiz()!, this.now()) : null));
  protected readonly playable = computed(() => !!this.quiz() && acceptsPlay(this.quiz()!, this.now()));
  protected readonly buyable = computed(() => !!this.quiz() && acceptsTickets(this.quiz()!));
  protected readonly ticketLimitReached = computed(() => {
    const max = this.quiz()?.maxTicketsPerPlayer;
    return !this.isTester() && max != null && this.ownedTickets() >= max;
  });
  protected readonly soldOut = computed(() => {
    const q = this.quiz();
    return !this.isTester() && !!q && q.maxTicketsTotal != null && q.ticketsSold >= q.maxTicketsTotal;
  });
  protected readonly canAfford = computed(() => {
    const wallet = this.state.wallet();
    return this.isTester() || (!!wallet && !!this.quiz() && wallet.creditBalance >= this.quiz()!.ticketPriceCredits);
  });
  protected readonly playersProgress = computed(() => {
    const q = this.quiz();
    return q ? Math.min(100, Math.round((q.playersRegistered / Math.max(1, q.minPlayers)) * 100)) : 0;
  });
  protected readonly maxVotes = computed(() => Math.max(1, ...(this.quiz()?.topics.map((t) => t.voteCount) ?? [1])));

  ionViewWillEnter(): void {
    void this.load();
  }

  /** Filet de securite : quelle que soit la sortie (onglet, retour), la fenetre ne reste pas affichee. */
  ionViewWillLeave(): void {
    void closeModal(this.buyOpen, this.buyModal());
  }

  protected async load(): Promise<void> {
    try {
      const [quiz, tickets, sessions] = await Promise.all([
        firstValueFrom(this.apiService.quiz(this.quizId)),
        firstValueFrom(this.apiService.quizTickets(this.quizId)),
        firstValueFrom(this.apiService.mySessions(this.quizId)),
      ]);
      // Un quiz solo (lien de notification, historique) se joue depuis son ecran de jeu.
      if (quiz.gameMode === 'SOLO') {
        void this.nav.navigateForward(`/quiz/${this.quizId}/jouer`, { replaceUrl: true });
        return;
      }
      this.quiz.set(quiz);
      this.tickets.set(tickets);
      this.sessions.set(sessions);
      this.error.set(null);
    } catch (e) {
      if (this.quiz()) {
        void this.feedback.error(e);
      } else {
        this.error.set(errorMessage(e));
      }
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await Promise.all([this.load(), this.state.refreshWallet()]);
    await event.target.complete();
  }

  // --- Affichage ---------------------------------------------------------------

  protected statusLabel(q: Quiz): string {
    return STATUS_LABELS[q.status];
  }

  protected statusCls(q: Quiz): string {
    return statusClass(q.status);
  }

  protected gradient(q: Quiz): string {
    return themeGradient(q);
  }

  protected rankText(r: Reward): string {
    return rankLabel(r);
  }

  protected medal(r: Reward): string {
    return r.rankFrom <= 3 && r.rankFrom === r.rankTo ? `medal${r.rankFrom}` : 'star';
  }

  protected closingText(q: Quiz): string {
    return formatCountdown(q.closingCountdownMinutes * 60_000);
  }

  // --- Actions -------------------------------------------------------------------

  protected async play(): Promise<void> {
    this.feedback.tap();
    await closeModal(this.buyOpen, this.buyModal());
    void this.nav.navigateForward(`/quiz/${this.quizId}/jouer`);
  }

  protected openBuy(): void {
    this.feedback.tap();
    this.bought.set(null);
    this.buyError.set(null);
    this.purchaseKey = null;
    void this.state.refreshWallet();
    this.buyOpen.set(true);
  }

  protected async confirmBuy(): Promise<void> {
    this.buying.set(true);
    this.buyError.set(null);
    this.purchaseKey ??= uuid();
    try {
      const ticket = await firstValueFrom(this.apiService.buyTicket(this.quizId, this.purchaseKey));
      this.purchaseKey = null;
      this.bought.set(ticket);
      void this.feedback.buzz('success');
      await Promise.all([this.state.refreshWallet(), this.load()]);
    } catch (e) {
      const code = errorCode(e);
      // Un refus metier est definitif : un nouvel essai sera un nouvel achat.
      if (code) {
        this.purchaseKey = null;
      }
      this.buyError.set(errorMessage(e));
      void this.feedback.buzz('error');
    } finally {
      this.buying.set(false);
    }
  }

  protected async goTopUp(): Promise<void> {
    await closeModal(this.buyOpen, this.buyModal());
    void this.nav.navigateForward('/portefeuille/recharger');
  }

  protected leaderboard(): void {
    this.feedback.tap();
    void this.nav.navigateForward(`/quiz/${this.quizId}/classement`);
  }

  protected review(sessionId: number): void {
    void this.nav.navigateForward(`/quiz/${this.quizId}/corrige/${sessionId}`);
  }

  protected async vote(topicId: number): Promise<void> {
    this.voting.set(topicId);
    try {
      this.quiz.set(await firstValueFrom(this.apiService.vote(this.quizId, topicId)));
      await this.feedback.success('Vote enregistré !');
    } catch (e) {
      await this.feedback.error(e);
    } finally {
      this.voting.set(null);
    }
  }
}
