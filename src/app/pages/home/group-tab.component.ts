import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ClockService } from '../../core/clock.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { Quiz } from '../../core/models';
import {
  STATUS_LABELS,
  acceptsPlay,
  acceptsTickets,
  statusClass,
  statusLine,
  statusRank,
  themeGradient,
  topPrizeHtg,
} from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { QuizCardComponent } from '../../ui/quiz-card.component';

/**
 * Onglet En groupe de l'accueil : le quiz a ne pas manquer en grand, puis tous
 * les quiz par etat.
 */
@Component({
  selector: 'raf-group-tab',
  imports: [QuizCardComponent, IconComponent, NumPipe],
  template: `

        @if (error(); as message) {
          <div class="panel">
            <div class="alert-box">{{ message }}</div>
            <button class="btn3d blue block" type="button" (click)="load()">Réessayer</button>
          </div>
        } @else if (!quizzes()) {
          <div class="skeleton hero-skel"></div>
          <div class="skeleton row-skel"></div>
          <div class="skeleton row-skel"></div>
        } @else if (quizzes()!.length === 0) {
          <div class="empty-state">
            <raf-icon class="float" name="hourglass" [size]="80" />
            <div class="empty-title">Aucun quiz pour le moment</div>
            <div class="empty-text">Le prochain arrive bientôt. Active les notifications pour être prévenu !</div>
          </div>
        } @else {
          @if (featured(); as q) {
            <section class="hero pop-in" (click)="open(q)">
              <div class="hero-art" [class.has-banner]="!!q.bannerUrl" [style.background]="q.bannerUrl ? null : gradient(q)">
                @if (q.bannerUrl; as url) {
                  <img [src]="url" alt="" />
                } @else {
                  <raf-icon class="float art-icon" name="trophy" [size]="96" />
                  <raf-icon class="float art-a" name="question" [size]="40" />
                  <raf-icon class="float art-b" name="star" [size]="30" />
                }
                <span class="status-tag hero-tag" [class]="'status-tag hero-tag ' + cls(q)">{{ label(q) }}</span>
                @if (ticketsFor(q.id) > 0) {
                  <span class="hero-tickets"><raf-icon name="ticket" [size]="24" />×{{ ticketsFor(q.id) }}</span>
                }
              </div>
              <div class="hero-body">
                <h2 class="hero-title">{{ q.title }}</h2>
                @if (q.themeLabel) {
                  <div class="hero-theme">{{ q.themeLabel }}</div>
                }
                <div class="hero-line" [class.urgent]="line(q).urgent">
                  <raf-icon name="clock" [size]="22" /> {{ line(q).text }}
                </div>
                <div class="prize">
                  <raf-icon name="crown" [size]="40" />
                  <div>
                    <div class="prize-label">1er prix</div>
                    <div class="prize-value">{{ prize(q) | num }} HTG</div>
                  </div>
                  <div class="spacer"></div>
                  <div class="prize-side">
                    <div><raf-icon name="users" [size]="20" /> {{ q.playersRegistered }}</div>
                    @if (q.free) {
                      <div><raf-icon name="gift" [size]="20" /> Gratuit</div>
                    } @else {
                      <div><raf-icon name="coin" [size]="20" /> {{ q.ticketPriceCredits }} / ticket</div>
                    }
                  </div>
                </div>
              </div>
            </section>
          }

          @if (live().length > 0) {
            <h2 class="section-title"><raf-icon name="flame" [size]="30" /> À jouer maintenant</h2>
            <div class="list stagger">
              @for (q of live(); track q.id) {
                <raf-quiz-card [quiz]="q" [tickets]="ticketsFor(q.id)" (click)="open(q)" />
              }
            </div>
          }

          @if (upcoming().length > 0) {
            <h2 class="section-title"><raf-icon name="ticket" [size]="30" /> Inscriptions ouvertes</h2>
            <div class="list stagger">
              @for (q of upcoming(); track q.id) {
                <raf-quiz-card [quiz]="q" [tickets]="ticketsFor(q.id)" (click)="open(q)" />
              }
            </div>
          }

          @if (past().length > 0) {
            <h2 class="section-title"><raf-icon name="trophy" [size]="30" /> Terminés</h2>
            <div class="list stagger">
              @for (q of past(); track q.id) {
                <raf-quiz-card [quiz]="q" [tickets]="ticketsFor(q.id)" (click)="open(q)" />
              }
            </div>
          }
        }
  `,
  styles: `
    :host { display: block; }
    .hero-skel { height: 380px; margin-bottom: 18px; }
    .row-skel { height: 118px; margin-bottom: 12px; }
    /* minmax(0, 1fr) : une carte au titre long retrecit au lieu d'elargir la colonne. */
    .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }

    .hero {
      border-radius: 28px;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 4px solid var(--raf-p200);
      box-shadow: inset 0 0 0 3px #fff, 0 7px 0 var(--raf-p300), 0 16px 28px rgba(184, 106, 0, 0.22);
      color: var(--raf-ink);
      overflow: hidden;
      cursor: pointer;
    }
    .hero-art {
      position: relative;
      height: 150px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-bottom: 4px solid var(--raf-p200);
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-conic-gradient(from 0deg at 50% 60%, rgba(255, 255, 255, 0.12) 0deg 10deg, transparent 10deg 24deg);
        pointer-events: none;
      }
    }
    /* Banniere 16/9 (format du back-office) : entiere a toutes les largeurs,
       au lieu d'une bande de 150px qui en rognait la moitie. */
    .hero-art.has-banner {
      height: auto;
      aspect-ratio: 16 / 9;
    }
    .art-icon { position: relative; z-index: 1; filter: drop-shadow(0 6px 0 rgba(184, 106, 0, 0.25)); }
    .art-a { position: absolute; left: 22%; top: 22%; animation-delay: -1s; }
    .art-b { position: absolute; right: 22%; top: 30%; animation-delay: -2s; }
    .hero-tag {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 2;
      font-size: 15px;
    }
    .hero-tickets {
      position: absolute;
      top: 10px;
      right: 12px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 10px 2px 4px;
      border-radius: 12px;
      background: rgba(184, 106, 0, 0.88);
      color: #fff;
      font-family: var(--raf-font-display);
      font-size: 17px;
    }
    .hero-body {
      padding: 14px 16px 22px;
    }
    .hero-title {
      margin: 0;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 27px;
      line-height: 1.1;
    }
    .hero-theme {
      font-weight: 800;
      color: var(--raf-ink-soft);
      margin-top: 2px;
    }
    .hero-line {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 12px;
      font-weight: 900;
      font-size: 15px;
      &.urgent {
        color: var(--raf-red-dark);
      }
    }
    .prize {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffad47, #ff8f00);
      border: 3px solid #a85f00;
      box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.35);
      color: #fff;
    }
    .prize-label {
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .prize-value {
      font-family: var(--raf-font-display);
      font-size: 26px;
      color: #fff;
      -webkit-text-stroke: 4px #a85f00;
      paint-order: stroke fill;
      line-height: 1;
    }
    .prize-side {
      display: grid;
      gap: 4px;
      font-weight: 800;
      font-size: 13px;
      div {
        display: flex;
        align-items: center;
        gap: 5px;
        justify-content: flex-end;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupTabComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly clock = inject(ClockService);
  private readonly feedback = inject(FeedbackService);

  protected readonly quizzes = signal<Quiz[] | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Tickets encore utilisables, par quiz. */
  private readonly activeTickets = signal<Map<number, number>>(new Map());

  private readonly sorted = computed(() =>
    [...(this.quizzes() ?? [])].sort((a, b) => statusRank(a.status) - statusRank(b.status)),
  );

  /** Le quiz mis en avant : jouable avec un ticket, sinon en cours, sinon a venir. */
  protected readonly featured = computed<Quiz | null>(() => {
    const now = this.clock.now();
    const all = this.sorted();
    return (
      all.find((q) => acceptsPlay(q, now) && this.ticketsFor(q.id) > 0) ??
      all.find((q) => acceptsPlay(q, now)) ??
      all.find((q) => acceptsTickets(q)) ??
      null
    );
  });

  protected readonly live = computed(() =>
    this.sorted().filter((q) => (q.status === 'RUNNING' || q.status === 'CLOSING') && q.id !== this.featured()?.id),
  );
  protected readonly upcoming = computed(() =>
    this.sorted().filter((q) => (q.status === 'REGISTRATION' || q.status === 'SCHEDULED') && q.id !== this.featured()?.id),
  );
  protected readonly past = computed(() =>
    this.sorted()
      .filter((q) => q.status === 'COMPUTING' || q.status === 'FINISHED' || q.status === 'CANCELLED')
      .slice(0, 6),
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const [page, tickets] = await Promise.all([
        firstValueFrom(this.apiService.quizzes(0, 50)),
        firstValueFrom(this.apiService.myTickets(0, 100)),
      ]);
      const active = new Map<number, number>();
      for (const t of tickets.content) {
        if (t.status === 'ACTIVE') {
          active.set(t.quizId, (active.get(t.quizId) ?? 0) + 1);
        }
      }
      this.activeTickets.set(active);
      this.quizzes.set(page.content);
    } catch (e) {
      if (!this.quizzes()) {
        this.error.set(errorMessage(e));
      } else {
        void this.feedback.error(e);
      }
    }
  }

  protected ticketsFor(quizId: number): number {
    return this.activeTickets().get(quizId) ?? 0;
  }

  /** Toute la carte ouvre le quiz : achat du ticket et lancement se font depuis sa page. */
  protected open(q: Quiz): void {
    this.feedback.tap();
    void this.nav.navigateForward(`/quiz/${q.id}`);
  }

  protected label(q: Quiz): string {
    return STATUS_LABELS[q.status];
  }

  protected cls(q: Quiz): string {
    return statusClass(q.status);
  }

  protected gradient(q: Quiz): string {
    return themeGradient(q);
  }

  protected prize(q: Quiz): number {
    return topPrizeHtg(q);
  }

  protected line(q: Quiz): { text: string; urgent: boolean } {
    return statusLine(q, this.clock.now());
  }
}
