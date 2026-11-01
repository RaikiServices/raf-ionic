import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ClockService } from '../core/clock.service';
import { Quiz } from '../core/models';
import { STATUS_LABELS, statusClass, statusLine, themeGradient, topPrizeHtg } from '../core/quiz-rules';
import { IconComponent } from './icon.component';
import { NumPipe } from './pipes';

/** Carte compacte d'un quiz (lobby, listes). */
@Component({
  selector: 'raf-quiz-card',
  imports: [IconComponent, NumPipe],
  template: `
    <article class="card" [class.dim]="quiz().status === 'FINISHED' || quiz().status === 'CANCELLED'">
      <div class="thumb" [style.background]="quiz().bannerUrl ? null : gradient()">
        @if (quiz().bannerUrl; as url) {
          <img [src]="url" alt="" loading="lazy" />
        } @else {
          <raf-icon name="question" [size]="44" />
        }
        @if (tickets() > 0) {
          <span class="tickets"><raf-icon name="ticket" [size]="20" />×{{ tickets() }}</span>
        }
      </div>
      <div class="body">
        <div class="top">
          <span class="status-tag" [class]="'status-tag ' + cls()">{{ label() }}</span>
        </div>
        <h3 class="name">{{ quiz().title }}</h3>
        <div class="line" [class.urgent]="line().urgent">{{ line().text }}</div>
        <div class="chips">
          <span class="chip"><raf-icon name="trophy" [size]="18" />{{ prize() | num }} HTG</span>
          @if (quiz().free) {
            <span class="chip free"><raf-icon name="gift" [size]="18" />Gratuit</span>
          } @else {
            <span class="chip"><raf-icon name="coin" [size]="18" />{{ quiz().ticketPriceCredits }}</span>
          }
          <span class="chip"><raf-icon name="users" [size]="18" />{{ quiz().playersRegistered }}</span>
        </div>
      </div>
    </article>
  `,
  styles: `
    /* Element personnalise : inline par defaut, et case de grille qui refuserait
       de retrecir sous la largeur du titre (nowrap) : la carte sortait de l'ecran. */
    :host {
      display: block;
      min-width: 0;
    }
    .card {
      display: flex;
      gap: 12px;
      padding: 10px;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 3px solid var(--raf-frame);
      box-shadow: inset 0 0 0 2px #fff, 0 5px 0 var(--raf-p300), 0 10px 16px rgba(184, 106, 0, 0.18);
      color: var(--raf-ink);
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .card:active {
      transform: translateY(3px) scale(0.99);
    }
    .card.dim {
      filter: saturate(0.6);
    }
    .thumb {
      position: relative;
      flex: none;
      width: 92px;
      height: 92px;
      border-radius: 16px;
      border: 3px solid #fff;
      box-shadow: 0 3px 0 rgba(184, 106, 0, 0.25);
      display: grid;
      place-items: center;
      overflow: hidden;
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    .tickets {
      position: absolute;
      bottom: 3px;
      right: 3px;
      display: inline-flex;
      align-items: center;
      gap: 1px;
      padding: 1px 6px 1px 2px;
      border-radius: 10px;
      background: rgba(184, 106, 0, 0.88);
      color: #fff;
      font-family: var(--raf-font-display);
      font-size: 13px;
    }
    .body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .name {
      margin: 2px 0 0;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 19px;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line {
      font-weight: 800;
      font-size: 13px;
      color: var(--raf-ink-soft);
    }
    .line.urgent {
      color: var(--raf-red-dark);
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .status-tag {
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizCardComponent {
  private readonly clock = inject(ClockService);

  readonly quiz = input.required<Quiz>();
  /** Tickets encore utilisables du joueur sur ce quiz. */
  readonly tickets = input(0);

  protected readonly label = computed(() => STATUS_LABELS[this.quiz().status]);
  protected readonly cls = computed(() => statusClass(this.quiz().status));
  protected readonly prize = computed(() => topPrizeHtg(this.quiz()));
  protected readonly gradient = computed(() => themeGradient(this.quiz()));
  protected readonly line = computed(() => statusLine(this.quiz(), this.clock.now()));
}
