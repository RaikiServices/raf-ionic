import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { Quiz } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { themeGradient } from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Onglet Solo : les quiz solo ouverts. Chaque partie se paie au lancement, un
 * sans-faute rapporte le prix, et chaque sujet ne se joue qu'une fois par jour.
 */
@Component({
  selector: 'raf-solo',
  imports: [IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, TopBarComponent, IconComponent, NumPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-pad">
        <h1 class="title-stroke heading">Solo</h1>
        <p class="lead">Un sans-faute, et c'est gagné !</p>

        <section class="glass how">
          <div><raf-icon name="coin" [size]="30" /><span>Tu paies ta partie en crédits</span></div>
          <div><raf-icon name="crown" [size]="30" /><span>Toutes les réponses justes : le prix est à toi</span></div>
          <div><raf-icon name="clock" [size]="30" /><span>Une partie par sujet et par jour</span></div>
        </section>

        @if (error(); as message) {
          <div class="panel">
            <div class="alert-box">{{ message }}</div>
            <button class="btn3d blue block" type="button" (click)="load()">Réessayer</button>
          </div>
        } @else if (!quizzes()) {
          <div class="skeleton card-skel"></div>
          <div class="skeleton card-skel"></div>
        } @else if (quizzes()!.length === 0) {
          <div class="empty-state">
            <raf-icon class="float" name="flame" [size]="80" />
            <div class="empty-title">Aucun défi solo pour le moment</div>
            <div class="empty-text">De nouveaux sujets arrivent bientôt.</div>
          </div>
        } @else {
          <div class="list stagger">
            @for (q of sorted(); track q.id) {
              <article class="card" [class.done]="played(q)" (click)="open(q)">
                <div class="thumb" [style.background]="q.bannerUrl ? null : gradient(q)">
                  @if (q.bannerUrl; as url) {
                    <img [src]="url" alt="" loading="lazy" />
                  } @else {
                    <raf-icon name="flame" [size]="44" />
                  }
                </div>
                <div class="body">
                  <h3 class="name">{{ q.title }}</h3>
                  <div class="subject">{{ q.selectedCategoryName }}</div>
                  <div class="prize"><raf-icon name="cash" [size]="26" /> {{ q.soloPrizeHtg | num }} HTG</div>
                  <div class="chips">
                    @if (q.free) {
                      <span class="chip free"><raf-icon name="gift" [size]="18" />Gratuit</span>
                    } @else {
                      <span class="chip"><raf-icon name="coin" [size]="18" />{{ q.ticketPriceCredits }}</span>
                    }
                    <span class="chip"><raf-icon name="question" [size]="18" />{{ q.questionsPerGame }} × {{ q.questionDurationSeconds }} s</span>
                  </div>
                </div>
                <div class="side">
                  @if (played(q)) {
                    <span class="status-tag finished">Demain</span>
                  } @else {
                    <button class="btn3d sm" type="button" (click)="open(q, $event)"><raf-icon name="play" [size]="18" /> Jouer</button>
                  }
                </div>
              </article>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .heading { font-size: 32px; margin: 6px 4px 0; }
    .lead { margin: 2px 4px 14px; font-weight: 800; color: var(--raf-ink-soft); }
    .how {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      margin-bottom: 18px;
      div { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 14px; }
    }
    .card-skel { height: 120px; margin-bottom: 12px; }
    /* minmax(0, 1fr) : une carte au titre long retrecit au lieu de pousser le bouton Jouer hors de l'ecran. */
    .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }

    .card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 3px solid var(--raf-p200);
      box-shadow: inset 0 0 0 2px #fff, 0 5px 0 var(--raf-p300), 0 10px 16px rgba(184, 106, 0, 0.18);
      color: var(--raf-ink);
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .card:active { transform: translateY(3px) scale(0.99); }
    .card.done { filter: saturate(0.55); opacity: 0.85; }
    .thumb {
      flex: none;
      width: 84px;
      height: 84px;
      border-radius: 16px;
      border: 3px solid #fff;
      box-shadow: 0 3px 0 rgba(184, 106, 0, 0.25);
      display: grid;
      place-items: center;
      overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .name {
      margin: 0;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 19px;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .subject { font-weight: 800; font-size: 13px; color: var(--raf-ink-soft); }
    .prize {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--raf-font-display);
      font-size: 20px;
      color: var(--raf-edge-dark);
    }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .side { flex: none; }

    /* Petit telephone : vignette reduite pour laisser la place au titre et au bouton. */
    @media (max-width: 380px) {
      .card { gap: 10px; padding: 8px; }
      .thumb { width: 64px; height: 64px; }
      .prize { font-size: 18px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoloPage {
  private readonly apiService = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly state = inject(PlayerStateService);
  private readonly feedback = inject(FeedbackService);

  protected readonly quizzes = signal<Quiz[] | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Sujets deja joues aujourd'hui. */
  private readonly playedSubjects = signal<Set<number>>(new Set());

  /** Les sujets encore jouables aujourd'hui d'abord. */
  protected readonly sorted = computed(() =>
    [...(this.quizzes() ?? [])].sort((a, b) => Number(this.played(a)) - Number(this.played(b))),
  );

  ionViewWillEnter(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    try {
      const [page, played] = await Promise.all([
        firstValueFrom(this.apiService.quizzes(0, 50, 'SOLO')),
        firstValueFrom(this.apiService.soloPlayedToday()),
      ]);
      this.playedSubjects.set(new Set(played));
      this.quizzes.set(page.content);
    } catch (e) {
      if (!this.quizzes()) {
        this.error.set(errorMessage(e));
      } else {
        void this.feedback.error(e);
      }
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await Promise.all([this.load(), this.state.refreshWallet()]);
    await event.target.complete();
  }

  protected played(q: Quiz): boolean {
    return q.selectedCategoryId != null && this.playedSubjects().has(q.selectedCategoryId);
  }

  protected open(q: Quiz, event?: Event): void {
    event?.stopPropagation();
    this.feedback.tap();
    void this.nav.navigateForward(`/quiz/${q.id}/jouer`);
  }

  protected gradient(q: Quiz): string {
    return themeGradient(q);
  }
}
