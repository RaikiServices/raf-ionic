import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TPipe } from '../core/i18n';
import { BADGES, MISSIONS, ProgressGain, TITLES } from '../core/progress';
import { IconComponent } from './icon.component';

/** Fin de partie : XP gagnee, passage de niveau, missions faites et badges debloques. */
@Component({
  selector: 'raf-progress-gain',
  imports: [TPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gain(); as g) {
      <div class="gain pop-in">
        @if (g.xp > 0) {
          <div class="xp">+{{ g.xp }} XP</div>
        }
        @if (g.levelUp) {
          <div class="level-up">
            <raf-icon name="star" [size]="30" />
            <span>{{ 'Niveau {n} atteint ! Tu es {titre}.' | t: { n: g.level, titre: (titles[g.title] | t) } }}</span>
          </div>
        }
        @for (m of g.missionsDone; track m) {
          <div class="line"><raf-icon name="check" [size]="22" /> {{ 'Mission réussie : {texte}' | t: { texte: (missions[m].text | t: { n: missionTarget(m) }) } }}</div>
        }
        @for (b of g.newBadges; track b) {
          <div class="line badge"><raf-icon [name]="badges[b].icon" [size]="22" /> {{ 'Nouveau badge : {nom}' | t: { nom: (badges[b].title | t) } }}</div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .gain { display: grid; gap: 6px; margin: 10px 0 4px; text-align: center; }
    .xp {
      font-family: var(--raf-font-display);
      font-size: 30px;
      color: #2f8a0e;
      text-shadow: 0 2px 0 #fff;
    }
    .level-up {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 14px;
      background: linear-gradient(180deg, #fff3b0, #ffd34d);
      border: 2px solid #c98a00;
      font-weight: 900;
    }
    .line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 800;
      font-size: 14px;
    }
    .badge { color: #7a3fc4; }
  `,
})
export class ProgressGainComponent {
  readonly gain = input<ProgressGain | null>(null);
  protected readonly titles = TITLES;
  protected readonly missions = MISSIONS;
  protected readonly badges = BADGES;

  protected missionTarget(id: keyof typeof MISSIONS): number {
    return id === 'CORRECT_TEN' ? 10 : id === 'TWO_SUBJECTS' ? 2 : 1;
  }
}
