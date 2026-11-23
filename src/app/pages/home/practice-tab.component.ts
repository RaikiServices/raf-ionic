import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { TPipe } from '../../core/i18n';
import { PracticeOverview, PracticeSubject } from '../../core/models';
import { themeGradient } from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';

/**
 * Onglet Entrainement : parties courtes et gratuites, sans gain, avec la correction
 * juste apres chaque reponse. Le meilleur endroit pour commencer : on apprend le jeu
 * sans rien risquer, et on gagne de l'XP et ses missions du jour.
 */
@Component({
  selector: 'raf-practice-tab',
  imports: [TPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="lead">{{ 'Entraîne-toi gratuitement, sans rien risquer !' | t }}</p>
    <section class="glass how">
      <div><raf-icon name="gift" [size]="26" /> {{ 'Gratuit : aucun crédit, aucun gain' | t }}</div>
      <div><raf-icon name="check" [size]="26" /> {{ 'La bonne réponse et l’explication tout de suite' | t }}</div>
      <div><raf-icon name="star" [size]="26" /> {{ '5 questions, des plus faciles aux plus dures' | t }}</div>
      <div><raf-icon name="flame" [size]="26" /> {{ 'Compte pour ton XP, tes missions et ta série' | t }}</div>
    </section>

    @if (error(); as message) {
      <div class="panel">
        <div class="alert-box">{{ message }}</div>
        <button class="btn3d blue block" type="button" (click)="load()">{{ 'Réessayer' | t }}</button>
      </div>
    } @else if (overview(); as o) {
      <div class="remaining" [class.none]="o.remainingToday === 0">
        <raf-icon name="hourglass" [size]="24" />
        @if (o.remainingToday > 0) {
          {{ (o.remainingToday > 1 ? '{n} entraînements restants aujourd’hui' : '{n} entraînement restant aujourd’hui') | t: { n: o.remainingToday } }}
        } @else {
          {{ 'Plus d’entraînement aujourd’hui : reviens demain, ou tente un défi Solo !' | t }}
        }
      </div>
      @if (o.subjects.length === 0) {
        <div class="empty-state">
          <raf-icon class="float" name="question" [size]="80" />
          <div class="empty-title">{{ 'Aucun sujet d’entraînement pour le moment' | t }}</div>
          <div class="empty-text">{{ 'De nouveaux sujets arrivent bientôt.' | t }}</div>
        </div>
      } @else {
        <div class="list stagger">
          @for (s of o.subjects; track s.id) {
            <button class="card" type="button" [disabled]="o.remainingToday === 0 && o.ongoingSessionId === null" (click)="open(s)">
              <div class="thumb" [style.background]="s.imageUrl ? null : gradient(s)">
                @if (s.imageUrl; as url) {
                  <img [src]="url" alt="" />
                } @else {
                  <raf-icon name="question" [size]="44" />
                }
              </div>
              <div class="body">
                <h3 class="name">{{ s.name }}</h3>
                <div class="sub">
                  @if (s.practicedCount > 0) {
                    {{ (s.practicedCount > 1 ? 'Déjà {n} entraînements' : 'Déjà {n} entraînement') | t: { n: s.practicedCount } }}
                  } @else {
                    {{ 'Jamais essayé' | t }}
                  }
                </div>
              </div>
              <span class="go btn3d green sm"><raf-icon name="play" [size]="22" /></span>
            </button>
          }
        </div>
      }
    } @else {
      <div class="skeleton card-skel"></div>
      <div class="skeleton card-skel"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .lead { margin: 2px 4px 14px; font-weight: 800; color: var(--raf-ink-soft); }
    .how {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      div { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 14px; }
    }
    .remaining {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 4px 14px;
      font-weight: 900;
      color: #2f8a0e;
    }
    .remaining.none { color: var(--raf-ink-soft); }
    .card-skel { height: 100px; margin-bottom: 12px; }
    .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .card {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 3px solid var(--raf-p200);
      box-shadow: inset 0 0 0 2px #fff, 0 5px 0 var(--raf-p300), 0 10px 16px rgba(184, 106, 0, 0.18);
      color: var(--raf-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .card:active { transform: translateY(3px) scale(0.99); }
    .card:disabled { filter: saturate(0.5); opacity: 0.7; cursor: default; }
    .thumb {
      flex: none;
      width: 68px;
      height: 68px;
      border-radius: 16px;
      border: 3px solid #fff;
      display: grid;
      place-items: center;
      overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .body { flex: 1; min-width: 0; }
    .name {
      margin: 0;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 19px;
      line-height: 1.1;
      // Deux lignes au plus : un nom de sujet long reste lisible sur un petit ecran.
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .sub { font-weight: 800; font-size: 13px; color: var(--raf-ink-soft); }
    .go { flex: none; pointer-events: none; }
    @media (max-width: 380px) {
      .card { gap: 10px; padding: 8px; }
      .thumb { width: 56px; height: 56px; border-radius: 14px; }
      .name { font-size: 17px; }
    }
  `,
})
export class PracticeTabComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly nav = inject(NavController);

  protected readonly overview = signal<PracticeOverview | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      this.overview.set(await firstValueFrom(this.api.practice()));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected open(subject: PracticeSubject): void {
    void this.nav.navigateForward(['/entrainement', subject.id]);
  }

  protected gradient(subject: PracticeSubject): string {
    return themeGradient(subject);
  }
}
