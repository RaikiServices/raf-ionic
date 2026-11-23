import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { TPipe } from '../../core/i18n';
import { Progress } from '../../core/models';
import { BADGES } from '../../core/progress';
import { IconComponent } from '../../ui/icon.component';
import { ProgressCardComponent } from '../../ui/progress-card.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

/** Progression complete : niveau, missions du jour, puis tous les badges (obtenus ou a gagner). */
@Component({
  selector: 'raf-progress',
  imports: [TPipe, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, ProgressCardComponent, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/accueil" [title]="'Ma progression' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (error(); as message) {
          <div class="panel">
            <div class="alert-box">{{ message }}</div>
            <button class="btn3d blue block" type="button" (click)="load()">{{ 'Réessayer' | t }}</button>
          </div>
        } @else if (progress(); as p) {
          <raf-progress-card [progress]="p" [showBadgesLink]="false" />
          <div class="totals">
            <span><strong>{{ p.totalXp | num }}</strong> {{ 'XP au total' | t }}</span>
            <span><strong>{{ p.bestStreakDays }}</strong> {{ 'jours de suite au mieux' | t }}</span>
          </div>
          <h2 class="badges-title title-stroke sm">{{ 'Badges' | t }}</h2>
          <div class="badges stagger">
            @for (b of p.badges; track b.id) {
              <div class="badge" [class.got]="b.achieved">
                <raf-icon [name]="b.achieved ? badges[b.id].icon : 'lock'" [size]="40" />
                <div class="b-title">{{ badges[b.id].title | t }}</div>
                <div class="b-text">{{ badges[b.id].text | t: { n: (b.target | num) } }}</div>
                @if (!b.achieved && b.target > 1) {
                  <div class="b-bar"><div class="b-fill" [style.width.%]="(b.progress / b.target) * 100"></div></div>
                  <div class="b-count">{{ b.progress | num }} / {{ b.target | num }}</div>
                }
              </div>
            }
          </div>
        } @else {
          <div class="skeleton" style="height: 320px"></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .totals { display: flex; justify-content: space-around; gap: 10px; margin: 14px 4px; font-weight: 800; font-size: 13.5px; text-align: center; }
    .badges-title { margin: 18px 4px 10px; }
    .badges { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 8px;
      border-radius: 18px;
      text-align: center;
      background: rgba(255, 255, 255, 0.6);
      border: 3px solid rgba(0, 0, 0, 0.08);
      filter: grayscale(0.9);
      opacity: 0.75;
    }
    .badge.got {
      filter: none;
      opacity: 1;
      background: linear-gradient(180deg, #fffbe6, #ffe9a3);
      border-color: #f0b400;
      box-shadow: 0 4px 0 #c98a00;
    }
    .b-title { font-family: var(--raf-font-display); font-size: 17px; line-height: 1.1; }
    .b-text { font-weight: 700; font-size: 12.5px; color: var(--raf-ink-soft); }
    .b-bar { width: 100%; height: 7px; border-radius: 999px; background: rgba(0, 0, 0, 0.1); overflow: hidden; }
    .b-fill { height: 100%; background: #f0a400; }
    .b-count { font-weight: 800; font-size: 12px; }
  `,
})
export class ProgressPage {
  private readonly api = inject(ApiService);
  protected readonly progress = signal<Progress | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly badges = BADGES;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      this.progress.set(await firstValueFrom(this.api.progress()));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
