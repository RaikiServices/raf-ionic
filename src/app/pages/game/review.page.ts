import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { GameOutcome, OutcomeResult } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe } from '../../core/i18n';

const RESULTS: Record<OutcomeResult, { icon: string; label: string }> = {
  CORRECT: { icon: 'check', label: 'Juste' },
  WRONG: { icon: 'cross', label: 'Fausse' },
  UNANSWERED: { icon: 'hourglass', label: 'Sans réponse' },
};

/**
 * Corrige d'une partie, visible une fois le quiz termine : juste ou fausse,
 * question par question. Ni enonce ni bonne reponse : les questions restent
 * dans le vivier, elles ne doivent pas circuler avec leurs reponses.
 */
@Component({
  selector: 'raf-review',
  imports: [TPipe, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar [back]="'/quiz/' + quizId" [title]="'Corrigé' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (review(); as r) {
          <section class="glass summary">
            <div><strong>{{ r.score ?? 0 }}</strong><span>{{ 'points' | t }}</span></div>
            <div><strong>{{ r.correctCount ?? 0 }}/{{ r.items.length }}</strong><span>{{ 'bonnes réponses' | t }}</span></div>
            @if (r.status === 'INVALIDATED') {
              <div class="invalid"><raf-icon name="warning" [size]="26" /><span>{{ 'Partie invalidée' | t }}</span></div>
            }
          </section>

          <section class="panel">
            <div class="rows stagger">
              @for (item of r.items; track item.position) {
                <div [class]="'row-item ' + item.result.toLowerCase()">
                  <span class="num">{{ 'Question {n}' | t: { n: item.position } }}</span>
                  <span class="mark">
                    <raf-icon [name]="results[item.result].icon" [size]="26" />
                    {{ results[item.result].label | t }}
                  </span>
                </div>
              }
            </div>
            <p class="note">{{ "Les questions et leurs réponses ne sont pas affichées : elles peuvent revenir dans d'autres quiz." | t }}</p>
          </section>
        } @else {
          <div class="skeleton" style="height: 90px; margin-bottom: 14px"></div>
          <div class="skeleton" style="height: 260px"></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .summary {
      display: flex;
      justify-content: space-around;
      padding: 14px;
      margin-bottom: 18px;
      text-align: center;
      div { display: flex; flex-direction: column; align-items: center; }
      strong { font-family: var(--raf-font-display); font-weight: 400; font-size: 28px; }
      span { font-weight: 800; font-size: 12.5px; color: var(--raf-ink-soft); }
      .invalid { color: var(--raf-red-dark); }
    }
    .rows { display: grid; gap: 8px; }
    .row-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 14px;
      background: #fff;
      border: 2px solid var(--raf-p100);
      font-weight: 800;
    }
    .num { font-family: var(--raf-font-display); font-weight: 400; font-size: 18px; }
    .mark { display: inline-flex; align-items: center; gap: 6px; }
    .correct { background: #e4f9d9; border-color: #a9e58e; color: #1d630b; }
    .wrong { background: #ffe3e6; border-color: #ffadb7; color: #8a0d1f; }
    .unanswered { color: var(--raf-ink-soft); }
    .note { margin: 14px 2px 0; font-size: 12.5px; font-weight: 700; color: var(--raf-ink-soft); line-height: 1.4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly quizId = Number(this.route.snapshot.paramMap.get('id'));
  private readonly sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));

  protected readonly results = RESULTS;
  protected readonly review = signal<GameOutcome | null>(null);
  protected readonly error = signal<string | null>(null);

  ionViewWillEnter(): void {
    if (!this.review()) {
      firstValueFrom(this.apiService.review(this.sessionId))
        .then((r) => this.review.set(r))
        .catch((e) => this.error.set(errorMessage(e)));
    }
  }
}
