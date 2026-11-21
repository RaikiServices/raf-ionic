import { NgTemplateOutlet } from '@angular/common';
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
import { QuizStatus, Ticket } from '../../core/models';
import { statusClass, statusLabel } from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe } from '../../core/i18n';

interface TicketGroup {
  quizId: number;
  quizTitle: string;
  quizStatus: QuizStatus;
  active: number;
  used: number;
  refunded: number;
  lastPurchase: string;
}

/** Mes tickets, regroupes par quiz : ceux a jouer d'abord. */
@Component({
  selector: 'raf-tickets',
  imports: [TPipe, NgTemplateOutlet, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, TopBarComponent, IconComponent, DateTimePipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar [title]="'Mes tickets' | t" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-pad">
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (groups() === null) {
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton" style="height: 96px; margin-bottom: 12px"></div>
          }
        } @else if (groups()!.length === 0) {
          <div class="empty-state">
            <raf-icon class="float" name="ticket" [size]="96" />
            <div class="empty-title">{{ "Aucun ticket pour l'instant" | t }}</div>
            <div class="empty-text">{{ 'Choisis un quiz et prends ton premier ticket pour tenter de gagner.' | t }}</div>
            <button class="btn3d orange" type="button" (click)="nav.navigateRoot('/accueil')">{{ 'Voir les quiz' | t }}</button>
          </div>
        } @else {
          @if (toPlay().length > 0) {
            <h2 class="section-title"><raf-icon name="play" [size]="22" /> {{ 'À jouer' | t }}</h2>
          }
          <div class="stagger">
            @for (g of toPlay(); track g.quizId) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: g }" />
            }
          </div>
          @if (others().length > 0) {
            <h2 class="section-title">{{ 'Historique' | t }}</h2>
          }
          <div class="stagger">
            @for (g of others(); track g.quizId) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: g }" />
            }
          </div>
        }
      </div>

      <ng-template #row let-g>
        <article class="ticket" [class.live]="g.active > 0" (click)="open(g.quizId)">
          <div class="stub">
            <raf-icon name="ticket" [size]="40" />
            <span class="stub-count">{{ g.active }}</span>
          </div>
          <div class="info">
            <span [class]="'status-tag ' + cls(g.quizStatus)">{{ label(g.quizStatus) }}</span>
            <h3>{{ g.quizTitle }}</h3>
            <div class="meta">
              @if (g.active > 0) {
                <span class="ok">{{ '{n} à jouer' | t: { n: g.active } }}</span>
              }
              @if (g.used > 0) {
                <span>{{ (g.used > 1 ? '{n} joués' : '{n} joué') | t: { n: g.used } }}</span>
              }
              @if (g.refunded > 0) {
                <span>{{ (g.refunded > 1 ? '{n} remboursés' : '{n} remboursé') | t: { n: g.refunded } }}</span>
              }
            </div>
            <div class="date">{{ 'Dernier achat' | t }} {{ g.lastPurchase | dateTime }}</div>
          </div>
        </article>
      </ng-template>
    </ion-content>
  `,
  styles: `
    .stagger { display: grid; gap: 14px; }
    .ticket {
      display: flex;
      border-radius: 20px;
      overflow: hidden;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 3px solid var(--raf-frame);
      box-shadow: 0 5px 0 var(--raf-p300), 0 10px 16px rgba(184, 106, 0, 0.18);
      color: var(--raf-ink);
      cursor: pointer;
    }
    .ticket:active { transform: translateY(3px); }
    .stub {
      position: relative;
      width: 82px;
      flex: none;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #ffe7cc, #ffd4a3);
      border-right: 3px dashed rgba(255, 255, 255, 0.7);
    }
    .live .stub { background: linear-gradient(180deg, #ffc078, #ff9a1a); }
    .stub-count {
      position: absolute;
      bottom: 8px;
      font-family: var(--raf-font-display);
      font-size: 20px;
      color: #fff;
      -webkit-text-stroke: 4px rgba(122, 61, 0, 0.4);
      paint-order: stroke fill;
    }
    .info { flex: 1; min-width: 0; padding: 12px 14px; }
    .status-tag { font-size: 12px; }
    h3 {
      margin: 6px 0 4px;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 19px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-weight: 800;
      font-size: 13px;
      color: var(--raf-ink-soft);
      .ok { color: #1d630b; }
    }
    .date { font-size: 12px; font-weight: 700; color: var(--raf-ink-soft); margin-top: 4px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketsPage {
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);

  protected readonly groups = signal<TicketGroup[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly toPlay = computed(() => (this.groups() ?? []).filter((g) => g.active > 0));
  protected readonly others = computed(() => (this.groups() ?? []).filter((g) => g.active === 0));

  ionViewWillEnter(): void {
    void this.load();
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  private async load(): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.myTickets(0, 200));
      this.groups.set(this.group(page.content));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private group(tickets: Ticket[]): TicketGroup[] {
    const groups = new Map<number, TicketGroup>();
    // Les tickets arrivent du plus recent au plus ancien : l'ordre des groupes suit.
    for (const t of tickets) {
      let g = groups.get(t.quizId);
      if (!g) {
        g = { quizId: t.quizId, quizTitle: t.quizTitle, quizStatus: t.quizStatus, active: 0, used: 0, refunded: 0, lastPurchase: t.purchasedAt };
        groups.set(t.quizId, g);
      }
      if (t.status === 'ACTIVE') {
        g.active++;
      } else if (t.status === 'USED') {
        g.used++;
      } else {
        g.refunded++;
      }
    }
    return [...groups.values()];
  }

  protected open(quizId: number): void {
    void this.nav.navigateForward(`/quiz/${quizId}`);
  }

  protected label(status: QuizStatus): string {
    return statusLabel(status);
  }

  protected cls(status: QuizStatus): string {
    return statusClass(status);
  }
}
