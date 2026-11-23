import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { TPipe } from '../../core/i18n';
import { PracticeQuestion, PracticeSession, Progress } from '../../core/models';
import { ProgressGain, progressGain, starsFor } from '../../core/progress';
import { SoundService } from '../../core/sound.service';
import { IconComponent } from '../../ui/icon.component';
import { ProgressGainComponent } from '../../ui/progress-gain.component';

type Phase = 'loading' | 'playing' | 'result' | 'failed';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
/** Chrono indicatif : rien a gagner, il apprend juste le rythme du vrai jeu. */
const QUESTION_MS = 20_000;

/**
 * Entrainement : 5 questions gratuites, des plus faciles aux plus dures. Apres chaque
 * reponse, la bonne reponse et l'explication s'affichent ; le joueur passe a la suivante
 * quand il veut. Le chrono est indicatif (tenu par l'appareil) : a zero, la question compte
 * comme fausse. Fin : etoiles, XP gagnee, missions et badges.
 */
@Component({
  selector: 'raf-practice',
  imports: [TPipe, IonContent, IconComponent, ProgressGainComponent],
  styleUrls: ['../game/game.page.scss', './practice.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="raf-night" [fullscreen]="true">
      <div class="screen">
        <header class="hud">
          <button class="btn3d red sm icon-only" type="button" [attr.aria-label]="'Quitter' | t" (click)="leave()">
            <raf-icon name="close" [size]="20" />
          </button>
          @if (phase() === 'playing' && session(); as s) {
            <div class="counter">
              <span class="counter-label">{{ 'Question' | t }}</span>
              <span class="counter-value">{{ index() + 1 }}<small>/{{ s.total }}</small></span>
            </div>
            <div class="spacer"></div>
            @if (!answered()) {
              <div class="timer" [class.hurry]="seconds() <= 5">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <circle class="track" cx="32" cy="32" r="27" />
                  <circle class="progress" cx="32" cy="32" r="27" pathLength="100" [attr.stroke-dasharray]="timeRatio() * 100 + ' 100'" />
                </svg>
                <span class="seconds">{{ seconds() }}</span>
              </div>
            } @else {
              <div class="practice-tag">{{ 'Entraînement' | t }}</div>
            }
          } @else {
            <div class="spacer"></div>
          }
        </header>

        @switch (phase()) {
          @case ('loading') {
            <div class="center-stage"><raf-icon class="float" name="hourglass" [size]="80" /></div>
          }

          @case ('playing') {
            @if (question(); as q) {
              @for (current of [q]; track current.id) {
                <div class="play slide-up">
                  <section class="question panel">
                    <div class="ribbon" [class.green]="current.difficulty === 'EASY'" [class.blue]="current.difficulty === 'MEDIUM'"
                         [class.purple]="current.difficulty === 'HARD'">
                      {{ difficultyLabel(current) | t }}
                    </div>
                    @if (current.imageUrl; as img) {
                      <img class="question-img" [src]="img" alt="" />
                    }
                    <p class="question-text">{{ current.text }}</p>
                  </section>

                  <div class="choices" [class.duo]="current.type === 'TRUE_FALSE'">
                    @for (c of current.choices; track c.id; let i = $index) {
                      <button
                        class="btn3d choice"
                        [class.blue]="!answered() && (current.type !== 'TRUE_FALSE' || i === 0)"
                        [class.purple]="!answered() && current.type === 'TRUE_FALSE' && i === 1"
                        [class.green]="answered() && c.id === current.correctChoiceId"
                        [class.red]="answered() && c.id === current.chosenChoiceId && !current.correct"
                        [class.faded]="answered() && c.id !== current.correctChoiceId && c.id !== current.chosenChoiceId"
                        [disabled]="answered() || busy()"
                        type="button"
                        (click)="choose(c.id)"
                      >
                        @if (current.type !== 'TRUE_FALSE') {
                          <span class="letter">{{ letters[i] }}</span>
                        }
                        @if (c.imageUrl; as img) {
                          <img class="choice-img" [src]="img" alt="" />
                        }
                        <span class="choice-text">{{ c.text }}</span>
                      </button>
                    }
                  </div>

                  @if (answered()) {
                    <section class="panel feedback pop-in" [class.good]="current.correct" [class.bad]="!current.correct">
                      <div class="verdict">
                        <raf-icon [name]="current.correct ? 'check' : 'cross'" [size]="30" />
                        @if (current.correct) {
                          {{ 'Bonne réponse !' | t }}
                        } @else if (current.chosenChoiceId === null) {
                          {{ 'Temps écoulé' | t }}
                        } @else {
                          {{ 'Raté !' | t }}
                        }
                      </div>
                      @if (current.explanation) {
                        <p class="explanation">{{ current.explanation }}</p>
                      }
                      <button class="btn3d block" type="button" (click)="next()">
                        {{ (isLast() ? 'Voir mon résultat' : 'Question suivante') | t }}
                      </button>
                    </section>
                  }
                </div>
              }
            }
          }

          @case ('result') {
            @if (session(); as s) {
              <div class="result">
                <div class="rays" aria-hidden="true"></div>
                <h1 class="title-stroke result-title pop-in">{{ resultTitle() | t }}</h1>
                <div class="stars">
                  @for (n of [1, 2, 3]; track n) {
                    <raf-icon class="star pop-in" [class.mid]="n === 2" [style.animation-delay.ms]="200 + n * 180" [name]="n <= stars() ? 'star' : 'star-empty'" [size]="n === 2 ? 84 : 64" />
                  }
                </div>
                <section class="panel score-panel slide-up">
                  <div class="ribbon purple">{{ 'Entraînement' | t }}</div>
                  <div class="score-label">{{ 'Bonnes réponses' | t }}</div>
                  <div class="score">{{ s.correct }}<small>/{{ s.total }}</small></div>
                  <raf-progress-gain [gain]="gain()" />
                  <p class="note">
                    @if (s.correct === s.total) {
                      {{ 'Parfait ! Tu es prêt pour un défi Solo : là, un sans-faute rapporte de l’argent.' | t }}
                    } @else {
                      {{ 'Chaque entraînement te fait progresser. Les questions changent à chaque fois.' | t }}
                    }
                  </p>
                  <div class="result-actions two">
                    <button class="btn3d blue" type="button" (click)="goTab('entrainement')">{{ 'Autre sujet' | t }}</button>
                    <button class="btn3d" type="button" (click)="goTab('solo')"><raf-icon name="flame" [size]="22" /> {{ 'Défi Solo' | t }}</button>
                  </div>
                </section>
              </div>
            }
          }

          @case ('failed') {
            <div class="center-stage">
              <raf-icon class="pop-in" name="warning" [size]="88" />
              <section class="panel fail-panel">
                <p class="fail-text">{{ error() }}</p>
                <button class="btn3d block" type="button" (click)="load()">{{ 'Réessayer' | t }}</button>
                <button class="btn3d blue block" type="button" (click)="goTab('entrainement')">{{ 'Retour' | t }}</button>
              </section>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
})
export class PracticePage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly sound = inject(SoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly categoryId = Number(this.route.snapshot.paramMap.get('categoryId'));

  protected readonly letters = LETTERS;
  protected readonly phase = signal<Phase>('loading');
  protected readonly session = signal<PracticeSession | null>(null);
  protected readonly index = signal(0);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly remainingMs = signal(QUESTION_MS);
  protected readonly gain = signal<ProgressGain | null>(null);
  private before: Progress | null = null;
  private readonly content = viewChild(IonContent);
  private timer: ReturnType<typeof setInterval> | null = null;
  private questionStartedAt = 0;

  protected readonly question = computed<PracticeQuestion | null>(() => this.session()?.questions[this.index()] ?? null);
  protected readonly answered = computed(() => this.question()?.correct != null);
  protected readonly isLast = computed(() => {
    const s = this.session();
    return !!s && this.index() >= s.total - 1;
  });
  protected readonly seconds = computed(() => Math.ceil(this.remainingMs() / 1000));
  protected readonly timeRatio = computed(() => Math.max(0, Math.min(1, this.remainingMs() / QUESTION_MS)));
  protected readonly stars = computed(() => {
    const s = this.session();
    return s ? starsFor(s.correct, s.total) : 0;
  });
  protected readonly resultTitle = computed(() =>
    this.stars() === 3 ? 'Parfait !' : this.stars() === 2 ? 'Bravo !' : this.stars() === 1 ? 'Bien joué !' : 'Continue comme ça !',
  );

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async load(): Promise<void> {
    this.phase.set('loading');
    this.error.set(null);
    try {
      this.before = await firstValueFrom(this.api.progress()).catch(() => null);
      const session = await firstValueFrom(this.api.startPractice(this.categoryId));
      this.session.set(session);
      if (session.finished) {
        await this.finish();
        return;
      }
      const first = session.questions.findIndex((q) => q.correct == null);
      this.index.set(first < 0 ? 0 : first);
      this.phase.set('playing');
      this.startTimer();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.phase.set('failed');
    }
  }

  protected difficultyLabel(q: PracticeQuestion): string {
    return q.difficulty === 'EASY' ? 'Facile' : q.difficulty === 'HARD' ? 'Difficile' : 'Moyen';
  }

  protected async choose(choiceId: number | null): Promise<void> {
    const s = this.session();
    const q = this.question();
    if (!s || !q || this.busy() || this.answered()) {
      return;
    }
    this.busy.set(true);
    this.stopTimer();
    try {
      const result = await firstValueFrom(this.api.answerPractice(s.sessionId, q.id, choiceId));
      this.session.set(result.session);
      this.sound.play(result.correct ? 'success' : 'error');
      // Petit ecran : la correction et le bouton « Question suivante » sont sous les
      // choix ; on les amene a l'ecran.
      setTimeout(() => void this.content()?.scrollToBottom(300), 60);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.phase.set('failed');
    } finally {
      this.busy.set(false);
    }
  }

  protected async next(): Promise<void> {
    const s = this.session();
    if (!s) {
      return;
    }
    if (this.isLast() || s.finished) {
      await this.finish();
      return;
    }
    this.index.update((i) => i + 1);
    void this.content()?.scrollToTop(0);
    this.startTimer();
  }

  protected goTab(tab: string): void {
    void this.nav.navigateRoot(['/accueil'], { queryParams: { onglet: tab } });
  }

  protected leave(): void {
    this.goTab('entrainement');
  }

  private async finish(): Promise<void> {
    this.stopTimer();
    this.phase.set('result');
    void this.content()?.scrollToTop(0);
    const s = this.session();
    this.sound.play(s && s.correct === s.total ? 'win' : 'success');
    const after = await firstValueFrom(this.api.progress()).catch(() => null);
    this.gain.set(progressGain(this.before, after));
  }

  private startTimer(): void {
    this.stopTimer();
    this.questionStartedAt = Date.now();
    this.remainingMs.set(QUESTION_MS);
    this.timer = setInterval(() => {
      const left = Math.max(0, QUESTION_MS - (Date.now() - this.questionStartedAt));
      this.remainingMs.set(left);
      if (left === 0) {
        this.stopTimer();
        void this.choose(null);
      }
    }, 200);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
