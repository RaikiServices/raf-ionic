import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonContent,
  IonFooter,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorCode, errorMessage } from '../../core/errors';
import { Leaderboard, LeaderboardEntry } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe, t } from '../../core/i18n';

const PAGE_SIZE = 50;

/** Classement fige d'un quiz termine : podium, liste, et la place du joueur toujours visible. */
@Component({
  selector: 'raf-leaderboard',
  imports: [TPipe, 
    IonHeader,
    IonToolbar,
    IonContent,
    IonFooter,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TopBarComponent,
    IconComponent,
    NumPipe,
  ],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar [back]="'/quiz/' + quizId" [title]="'Classement' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (notReady()) {
          <div class="empty-state">
            <raf-icon class="float" name="hourglass" [size]="88" />
            <div class="empty-title">{{ 'Classement pas encore publié' | t }}</div>
            <div class="empty-text">{{ 'Il sera figé à la fin du quiz. Nous te préviendrons !' | t }}</div>
          </div>
        } @else if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (board(); as b) {
          <h1 class="quiz-title title-stroke sm">{{ b.quizTitle }}</h1>
          <p class="sub">{{ (b.totalRanked > 1 ? '{n} joueurs classés' : '{n} joueur classé') | t: { n: b.totalRanked } }}</p>

          @if (podium().length > 0) {
            <div class="podium">
              @for (e of podium(); track e.rank) {
                <div class="place" [class]="'place p' + e.rank" [class.me]="e.me">
                  @if (e.rank === 1) {
                    <raf-icon class="crown float" name="crown" [size]="46" />
                  }
                  <div class="avatar">{{ initial(e) }}</div>
                  <div class="name">{{ e.me ? ('Toi' | t) : e.displayName }}</div>
                  <div class="pts">{{ '{n} pts' | t: { n: e.score } }}</div>
                  <div class="step">
                    <raf-icon [name]="'medal' + e.rank" [size]="40" />
                    @if (e.rewardHtg > 0) {
                      <span class="gain">+{{ e.rewardHtg | num }} HTG</span>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <div class="rows">
            @for (e of rest(); track e.rank) {
              <div class="list-row" [class.me]="e.me">
                <span class="rank">{{ e.rank }}</span>
                <div class="grow">
                  <div class="row-title">{{ e.me ? ('Toi' | t) : e.displayName }}</div>
                  @if (e.rewardHtg > 0) {
                    <div class="row-sub gain-sub">+{{ e.rewardHtg | num }} HTG</div>
                  }
                </div>
                <span class="score">{{ e.score }}</span>
              </div>
            }
          </div>

          <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="more($event)">
            <ion-infinite-scroll-content />
          </ion-infinite-scroll>
        } @else {
          <div class="skeleton" style="height: 240px; margin-bottom: 14px"></div>
          <div class="skeleton" style="height: 300px"></div>
        }
      </div>
    </ion-content>

    @if (board()?.me; as me) {
      <ion-footer class="me-bar">
        <div class="me-row">
          <span class="rank">{{ me.rank }}<small>{{ 'e' | t }}</small></span>
          <div class="grow">
            <div class="me-title">{{ 'Ta place' | t }}</div>
            <div class="me-sub">{{ '{n} pts' | t: { n: me.score } }}</div>
          </div>
          @if (me.rewardHtg > 0) {
            <span class="me-gain"><raf-icon name="cash" [size]="30" /> +{{ me.rewardHtg | num }} HTG</span>
          }
        </div>
      </ion-footer>
    }
  `,
  styles: `
    .quiz-title { text-align: center; font-size: 24px; margin: 4px 0 0; }
    .sub { text-align: center; font-weight: 800; color: var(--raf-ink-soft); margin: 4px 0 18px; }

    .podium {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      align-items: end;
      gap: 8px;
      margin: 30px 0 18px;
    }
    .place {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-width: 0;
    }
    .p1 { order: 2; }
    .p2 { order: 1; }
    .p3 { order: 3; }
    .crown {
      position: absolute;
      top: -38px;
      z-index: 1;
    }
    .avatar {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      border: 4px solid #fff;
      background: linear-gradient(180deg, #ffd4a3, #ffad47);
      color: #fff;
      font-family: var(--raf-font-display);
      font-size: 26px;
      -webkit-text-stroke: 4px var(--raf-edge-dark);
      paint-order: stroke fill;
      box-shadow: 0 4px 0 rgba(184, 106, 0, 0.35);
    }
    .p1 .avatar {
      width: 78px;
      height: 78px;
      font-size: 32px;
      background: linear-gradient(180deg, #ffc078, #ff9a1a);
      -webkit-text-stroke-color: #a85f00;
    }
    .me .avatar {
      border-color: var(--raf-primary);
    }
    .name {
      margin-top: 6px;
      max-width: 100%;
      font-weight: 900;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pts {
      font-family: var(--raf-font-display);
      font-size: 17px;
      color: #fff;
      -webkit-text-stroke: 3px var(--raf-edge-dark);
      paint-order: stroke fill;
    }
    .step {
      width: 100%;
      margin-top: 6px;
      padding: 10px 4px;
      border-radius: 16px 16px 6px 6px;
      background: linear-gradient(180deg, #ffffff, var(--raf-p100));
      border: 3px solid var(--raf-p200);
      box-shadow: 0 5px 0 var(--raf-p300);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: var(--raf-ink);
    }
    .p1 .step { min-height: 120px; }
    .p2 .step { min-height: 92px; }
    .p3 .step { min-height: 74px; }
    .gain {
      font-family: var(--raf-font-display);
      font-size: 14px;
      color: var(--raf-edge-dark);
    }

    .rows { display: grid; }
    .list-row.me {
      border-color: var(--raf-primary);
      background: var(--raf-p50);
      box-shadow: 0 3px 0 var(--raf-edge);
    }
    .rank {
      width: 36px;
      text-align: center;
      font-family: var(--raf-font-display);
      font-size: 22px;
      color: var(--raf-ink-soft);
    }
    .score {
      font-family: var(--raf-font-display);
      font-size: 20px;
    }
    .gain-sub { color: var(--raf-edge-dark); }

    .me-bar {
      background: transparent;
      box-shadow: none;
      &::before { display: none; }
    }
    .me-row {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 560px;
      margin: 0 auto 0;
      padding: 12px 18px calc(12px + var(--raf-safe-bottom));
      background: linear-gradient(180deg, #ffc078, #ff9a1a);
      border-top: 3px solid #ffffff;
      border-radius: 22px 22px 0 0;
      box-shadow: 0 -6px 18px rgba(184, 106, 0, 0.3);
      color: #fff;
      -webkit-text-stroke: 3px #a85f00;
      paint-order: stroke fill;
      .rank {
        color: #fff;
        font-size: 30px;
        width: auto;
        small { font-size: 16px; }
      }
      .grow { flex: 1; }
    }
    .me-title { font-family: var(--raf-font-display); font-size: 19px; }
    .me-sub { font-weight: 900; -webkit-text-stroke: 0; color: #5c2e00; }
    .me-gain {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--raf-font-display);
      font-size: 19px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardPage {
  private readonly apiService = inject(ApiService);
  protected readonly quizId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly board = signal<Leaderboard | null>(null);
  protected readonly entries = signal<LeaderboardEntry[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notReady = signal(false);
  private page = 0;

  protected readonly podium = computed(() => this.entries().filter((e) => e.rank <= 3).slice(0, 3));
  protected readonly rest = computed(() => this.entries().filter((e) => !this.podium().includes(e)));
  protected readonly hasMore = computed(() => {
    const b = this.board();
    return !!b && this.entries().length < b.totalRanked;
  });

  ionViewWillEnter(): void {
    if (!this.board()) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      const board = await firstValueFrom(this.apiService.leaderboard(this.quizId, 0, PAGE_SIZE));
      this.page = 0;
      this.board.set(board);
      this.entries.set(board.entries);
    } catch (e) {
      if (errorCode(e) === 'GAME_RESULTS_NOT_READY') {
        this.notReady.set(true);
      } else {
        this.error.set(errorMessage(e));
      }
    }
  }

  protected async more(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      const next = await firstValueFrom(this.apiService.leaderboard(this.quizId, this.page + 1, PAGE_SIZE));
      this.page++;
      this.entries.update((list) => [...list, ...next.entries]);
    } finally {
      await event.target.complete();
    }
  }

  protected initial(e: LeaderboardEntry): string {
    return (e.me ? t('Toi') : e.displayName).charAt(0).toUpperCase();
  }
}
