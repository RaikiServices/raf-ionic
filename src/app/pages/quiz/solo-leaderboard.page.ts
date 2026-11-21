import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { TPipe } from '../../core/i18n';
import { SoloLeaderboard, SoloLeaderboardEntry } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Classement d'un quiz solo, preuve sociale avant de jouer : une ligne par joueur
 * avec son meilleur score et ce qu'il a gagne sur ce quiz. Noms masques par le
 * serveur (« Je*** Do*** »). Top 50, plus la place du joueur en bas s'il n'y est pas.
 */
@Component({
  selector: 'raf-solo-leaderboard',
  imports: [TPipe, IonHeader, IonToolbar, IonContent, IonFooter, IonRefresher, IonRefresherContent, TopBarComponent, IconComponent, NumPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar [back]="'/quiz/' + quizId + '/jouer'" [title]="'Classement' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="wrap">
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (board(); as b) {
          <h1 class="title title-stroke">{{ b.quizTitle }}</h1>

          <section class="stats">
            <div class="stat glass">
              <raf-icon name="users" [size]="34" />
              <strong>{{ b.players | num }}</strong>
              <span>{{ (b.players > 1 ? 'joueurs' : 'joueur') | t }}</span>
            </div>
            <div class="stat glass">
              <raf-icon name="crown" [size]="34" />
              <strong>{{ b.perfects | num }}</strong>
              <span>{{ (b.perfects > 1 ? 'sans-fautes' : 'sans-faute') | t }}</span>
            </div>
            <div class="stat glass money">
              <raf-icon name="cash" [size]="34" />
              <strong>{{ b.wonHtg | num }}</strong>
              <span>{{ 'HTG gagnés' | t }}</span>
            </div>
          </section>

          @if (b.entries.length === 0) {
            <div class="empty-state">
              <raf-icon class="float" name="trophy" [size]="88" />
              <div class="empty-title">{{ 'Personne n’a encore joué' | t }}</div>
              <div class="empty-text">{{ 'Sois le premier au classement de ce quiz !' | t }}</div>
            </div>
          } @else {
            <section class="panel board">
              <div class="row head" aria-hidden="true">
                <span class="rank">#</span>
                <span class="name">{{ 'Joueur' | t }}</span>
                <span class="score">{{ 'Meilleur score' | t }}</span>
                <span class="won">{{ 'Gagné' | t }}</span>
              </div>
              @for (e of b.entries; track e.rank) {
                <div class="row" [class.me]="e.me" [class.top]="e.rank <= 3">
                  <span class="rank">
                    @if (e.rank <= 3) {
                      <raf-icon [name]="'medal' + e.rank" [size]="30" />
                    } @else {
                      {{ e.rank }}
                    }
                  </span>
                  <span class="name">
                    <span class="who">{{ e.me ? ('Toi' | t) : e.displayName }}</span>
                    @if (e.perfects > 1) {
                      <span class="perfects">{{ '{n} sans-fautes' | t: { n: e.perfects } }}</span>
                    }
                  </span>
                  <span class="score" [class.perfect]="perfect(e)">
                    @if (perfect(e)) {
                      <raf-icon name="crown" [size]="20" />
                    }
                    {{ e.bestCorrect }}<small>/{{ b.questionsPerGame }}</small>
                  </span>
                  <span class="won" [class.zero]="e.wonHtg === 0">{{ e.wonHtg | num }} <small>HTG</small></span>
                </div>
              }
            </section>
            <p class="note">{{ 'Une ligne par joueur : son meilleur score et tout ce qu’il a gagné sur ce quiz.' | t }}</p>
          }
        } @else {
          <div class="skeleton" style="height: 120px; margin-bottom: 14px"></div>
          <div class="skeleton" style="height: 320px"></div>
        }
      </div>
    </ion-content>

    @if (outsideTop(); as me) {
      <ion-footer class="me-bar">
        <div class="me-row">
          <span class="me-rank">{{ me.rank }}<small>{{ 'e' | t }}</small></span>
          <div class="grow">
            <div class="me-title">{{ 'Ta place' | t }}</div>
            <div class="me-sub">{{ me.bestCorrect }}/{{ board()?.questionsPerGame }} · {{ me.wonHtg | num }} HTG</div>
          </div>
        </div>
      </ion-footer>
    }
  `,
  styles: `
    .wrap {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      padding: 14px 16px calc(28px + var(--raf-safe-bottom));
    }
    .title { text-align: center; font-size: clamp(22px, 5vw, 30px); margin: 2px 0 14px; overflow-wrap: anywhere; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 12px 6px;
      text-align: center;
      min-width: 0;
      strong { font-family: var(--raf-font-display); font-weight: 400; font-size: clamp(20px, 5vw, 28px); line-height: 1.1; overflow-wrap: anywhere; }
      span { font-weight: 800; font-size: 12.5px; color: var(--raf-ink-soft); }
    }
    .board { padding: 6px 4px; }
    .row {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 14px;
      & + & { border-top: 2px dashed var(--raf-p100); }
    }
    .row.head {
      padding-top: 6px;
      padding-bottom: 6px;
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--raf-ink-soft);
      border-top: 0;
    }
    .row.me { background: var(--raf-p100); border-top-color: transparent; }
    .row.me + .row { border-top-color: transparent; }
    .rank {
      display: flex;
      justify-content: center;
      font-family: var(--raf-font-display);
      font-size: 20px;
    }
    .name { min-width: 0; display: grid; }
    .who { font-weight: 900; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .perfects { font-weight: 800; font-size: 12px; color: var(--raf-edge-dark); }
    .score {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      justify-content: flex-end;
      font-family: var(--raf-font-display);
      font-size: 20px;
      white-space: nowrap;
      small { font-size: 14px; color: var(--raf-ink-soft); }
      &.perfect { color: var(--raf-edge-dark); }
    }
    .won {
      min-width: 92px;
      text-align: right;
      font-weight: 900;
      font-size: 15px;
      color: #1d8a0b;
      white-space: nowrap;
      small { font-size: 11px; }
      &.zero { color: var(--raf-ink-soft); font-weight: 700; }
    }
    .row.head .score, .row.head .won { font-family: inherit; font-size: 12px; color: var(--raf-ink-soft); }
    .note { margin: 12px 4px 0; text-align: center; font-weight: 700; font-size: 12.5px; color: var(--raf-ink-soft); }

    /* Petit telephone : le gain passe sous le nom, le score reste a droite. */
    @media (max-width: 420px) {
      .row { grid-template-columns: 36px minmax(0, 1fr) auto; row-gap: 2px; }
      .row .won { grid-column: 2; grid-row: 2; text-align: left; min-width: 0; font-size: 13.5px; }
      .row .score { grid-row: 1 / span 2; grid-column: 3; }
      .row.head .won { display: none; }
      .row.head .score { grid-row: auto; }
      .stat span { font-size: 11px; }
    }
    /* Grand ecran : plus d'air. */
    @media (min-width: 768px) {
      .row { grid-template-columns: 56px minmax(0, 1fr) 120px 140px; padding: 12px 16px; }
      .who { font-size: 16px; }
    }

    .me-bar { box-shadow: 0 -4px 14px rgba(74, 47, 18, 0.15); }
    .me-row {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 720px;
      margin: 0 auto;
      padding: 10px 18px calc(10px + var(--raf-safe-bottom));
      background: linear-gradient(180deg, #ffc078, var(--raf-primary));
      color: #fff;
    }
    .me-rank { font-family: var(--raf-font-display); font-size: 30px; small { font-size: 16px; } }
    .grow { flex: 1; min-width: 0; }
    .me-title { font-family: var(--raf-font-display); font-size: 19px; }
    .me-sub { font-weight: 900; color: #5c2e00; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoloLeaderboardPage {
  private readonly apiService = inject(ApiService);
  protected readonly quizId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly board = signal<SoloLeaderboard | null>(null);
  protected readonly error = signal<string | null>(null);

  /** La place du joueur, affichee en bas seulement s'il est hors du top. */
  protected readonly outsideTop = computed(() => {
    const b = this.board();
    return b?.me && !b.entries.some((e) => e.me) ? b.me : null;
  });

  ionViewWillEnter(): void {
    void this.load();
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  protected perfect(e: SoloLeaderboardEntry): boolean {
    const b = this.board();
    return !!b && e.bestCorrect >= b.questionsPerGame;
  }

  private async load(): Promise<void> {
    try {
      this.board.set(await firstValueFrom(this.apiService.soloLeaderboard(this.quizId)));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
