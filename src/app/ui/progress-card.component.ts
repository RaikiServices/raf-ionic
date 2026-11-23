import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TPipe } from '../core/i18n';
import { Progress } from '../core/models';
import { MISSIONS, TITLES } from '../core/progress';
import { IconComponent } from './icon.component';
import { NumPipe } from './pipes';

/**
 * Carte de progression : niveau, titre, barre d'XP, serie de jours et missions du jour.
 * L'XP ne rapporte ni credit ni gourde : elle montre au joueur qu'il avance.
 */
@Component({
  selector: 'raf-progress-card',
  imports: [TPipe, IconComponent, NumPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (progress(); as p) {
      <section class="panel panel-with-ribbon progress-card" data-guide="progress">
        <div class="ribbon gold">{{ 'Ma progression' | t }}</div>
        <div class="head">
          <div class="level" [attr.aria-label]="'Niveau {n}' | t: { n: p.level }">
            <span class="level-label">{{ 'Niv.' | t }}</span>
            <span class="level-value">{{ p.level }}</span>
          </div>
          <div class="head-body">
            <div class="title">{{ titles[p.title] | t }}</div>
            <div class="bar" role="progressbar" [attr.aria-valuenow]="p.levelXp" [attr.aria-valuemax]="p.levelXpNeeded">
              <div class="fill" [style.width.%]="ratio()"></div>
            </div>
            <div class="xp">{{ '{a} / {b} XP vers le niveau {n}' | t: { a: (p.levelXp | num), b: (p.levelXpNeeded | num), n: p.level + 1 } }}</div>
          </div>
          <div class="streak" [class.on]="p.currentStreakDays > 0">
            <raf-icon name="flame" [size]="34" />
            <span>{{ p.currentStreakDays }}</span>
          </div>
        </div>

        <h3 class="missions-title" data-guide="progress-missions">
          {{ 'Missions du jour' | t }}
          @if (p.allMissionsDone) {
            <span class="all-done"><raf-icon name="check" [size]="18" /> {{ 'Toutes faites !' | t }}</span>
          }
        </h3>
        <ul class="missions">
          @for (m of p.missions; track m.id) {
            <li [class.done]="m.done">
              <raf-icon [name]="m.done ? 'check' : missions[m.id].icon" [size]="26" />
              <div class="m-body">
                <div class="m-text">{{ missions[m.id].text | t: { n: m.target } }}</div>
                @if (m.target > 1 && !m.done) {
                  <div class="m-bar"><div class="m-fill" [style.width.%]="(m.progress / m.target) * 100"></div></div>
                }
              </div>
              <span class="m-xp">+{{ m.xp }} XP</span>
            </li>
          }
        </ul>
        <p class="bonus">
          @if (p.allMissionsDone) {
            {{ 'Bonus de la journée gagné : +{n} XP. Reviens demain pour de nouvelles missions !' | t: { n: p.allMissionsBonusXp } }}
          } @else {
            {{ 'Toutes les missions faites : +{n} XP de bonus. L’entraînement gratuit compte aussi !' | t: { n: p.allMissionsBonusXp } }}
          }
        </p>
        @if (showBadgesLink()) {
          <button class="btn3d purple block" type="button" routerLink="/progression" data-guide="progress-badges">
            <raf-icon name="trophy" [size]="24" /> {{ 'Mes badges ({n}/{total})' | t: { n: achieved(), total: p.badges.length } }}
          </button>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .progress-card { margin-top: 30px; margin-bottom: 8px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .level {
      flex: none;
      width: 66px;
      height: 66px;
      border-radius: 50%;
      display: grid;
      place-content: center;
      text-align: center;
      background: radial-gradient(circle at 35% 30%, #ffe27a, #f0a400);
      border: 3px solid #8f5d00;
      box-shadow: inset 0 0 0 2px #fff6b0, 0 4px 0 #8f5d00;
      color: #5a3a00;
    }
    .level-label { font-size: 11px; font-weight: 900; text-transform: uppercase; line-height: 1; }
    .level-value { font-family: var(--raf-font-display); font-size: 28px; line-height: 1; }
    .head-body { flex: 1; min-width: 0; }
    .title { font-family: var(--raf-font-display); font-size: 21px; line-height: 1.1; }
    .bar {
      height: 14px;
      margin: 6px 0 4px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.1);
      overflow: hidden;
      box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.12);
    }
    .fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(180deg, #8ee04a, #3fa516);
      transition: width 0.6s ease;
    }
    .xp { font-size: 12.5px; font-weight: 800; color: var(--raf-ink-soft); }
    .streak {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: var(--raf-font-display);
      font-size: 18px;
      filter: grayscale(1);
      opacity: 0.6;
    }
    .streak.on { filter: none; opacity: 1; }
    .missions-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 8px;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 19px;
    }
    .all-done { display: inline-flex; align-items: center; gap: 4px; font-family: inherit; font-size: 14px; color: #2f8a0e; }
    .missions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .missions li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.7);
      border: 2px solid var(--raf-p200);
    }
    .missions li.done { background: #e6f9d6; border-color: #9ed97a; }
    .missions li.done .m-text { text-decoration: line-through; opacity: 0.75; }
    .m-body { flex: 1; min-width: 0; }
    .m-text { font-weight: 800; font-size: 14px; }
    .m-bar { height: 7px; margin-top: 4px; border-radius: 999px; background: rgba(0, 0, 0, 0.1); overflow: hidden; }
    .m-fill { height: 100%; background: #f0a400; }
    .m-xp { flex: none; font-weight: 900; font-size: 13px; color: #2f8a0e; }
    .bonus { margin: 10px 2px 12px; font-size: 12.5px; font-weight: 700; color: var(--raf-ink-soft); }
  `,
})
export class ProgressCardComponent {
  readonly progress = input<Progress | null>(null);
  /** Bouton vers la page des badges ; inutile sur cette page elle-meme. */
  readonly showBadgesLink = input(true);
  protected readonly titles = TITLES;
  protected readonly missions = MISSIONS;

  protected readonly ratio = computed(() => {
    const p = this.progress();
    return p && p.levelXpNeeded ? Math.min(100, (p.levelXp / p.levelXpNeeded) * 100) : 0;
  });
  protected readonly achieved = computed(() => this.progress()?.badges.filter((b) => b.achieved).length ?? 0);
}
