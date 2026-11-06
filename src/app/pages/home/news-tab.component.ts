import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { NewsItem, PlayerStats } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { DatePipe, NumPipe } from '../../ui/pipes';

const PAGE_SIZE = 10;

/**
 * Onglet Actualite de l'accueil : les statistiques personnelles du joueur, puis
 * les actualites publiees par l'equipe (epinglees d'abord).
 *
 * Les statistiques ne portent que sur les parties du joueur : rien sur les
 * autres joueurs ni sur le nombre de gagnants.
 */
@Component({
  selector: 'raf-news-tab',
  imports: [IconComponent, NumPipe, DatePipe],
  template: `
    <section class="panel panel-with-ribbon stats">
      <div class="ribbon purple">Mes stats</div>
      @if (stats(); as s) {
        @if (s.gamesPlayed === 0) {
          <p class="stats-empty">Joue ta première partie pour voir tes statistiques ici !</p>
        } @else {
          <div class="streak" [class.on]="s.currentStreakDays > 0">
            <raf-icon name="flame" [size]="40" />
            <div>
              <div class="streak-value">{{ s.currentStreakDays }} jour{{ s.currentStreakDays > 1 ? 's' : '' }}</div>
              <div class="streak-label">
                @if (s.currentStreakDays > 0) {
                  de suite · record {{ s.bestStreakDays }} jour{{ s.bestStreakDays > 1 ? 's' : '' }}
                } @else {
                  Joue aujourd'hui pour lancer une série !
                }
              </div>
            </div>
          </div>
          <div class="grid">
            <div class="tile">
              <raf-icon name="ticket" [size]="26" />
              <div class="value">{{ s.gamesPlayed | num }}</div>
              <div class="label">Parties jouées</div>
            </div>
            <div class="tile">
              <raf-icon name="check" [size]="26" />
              <div class="value">{{ s.accuracyPercent ?? 0 }} %</div>
              <div class="label">Bonnes réponses</div>
            </div>
            <div class="tile">
              <raf-icon name="crown" [size]="26" />
              <div class="value">{{ s.bestRank ? s.bestRank + (s.bestRank === 1 ? 'er' : 'e') : '–' }}</div>
              <div class="label">Meilleure place</div>
            </div>
            <div class="tile">
              <raf-icon name="trophy" [size]="26" />
              <div class="value">{{ s.podiums | num }}</div>
              <div class="label">Podiums</div>
            </div>
            <div class="tile">
              <raf-icon name="star" [size]="26" />
              <div class="value">{{ s.perfectSoloGames | num }}</div>
              <div class="label">Sans-fautes solo</div>
            </div>
            <div class="tile">
              <raf-icon name="cash" [size]="26" />
              <div class="value">{{ s.totalWinningsHtg | num }}</div>
              <div class="label">HTG gagnés</div>
            </div>
          </div>
          @if (s.favoriteSubject) {
            <div class="favorite"><raf-icon name="question" [size]="24" /> Sujet préféré : <strong>{{ s.favoriteSubject }}</strong></div>
          }
        }
      } @else if (statsError()) {
        <p class="stats-empty">Statistiques indisponibles pour le moment.</p>
      } @else {
        <div class="skeleton stats-skel"></div>
      }
    </section>

    <h2 class="section-title"><raf-icon name="bell" [size]="30" /> Les nouvelles</h2>

    @if (error(); as message) {
      <div class="panel">
        <div class="alert-box">{{ message }}</div>
        <button class="btn3d blue block" type="button" (click)="load()">Réessayer</button>
      </div>
    } @else if (!news()) {
      <div class="skeleton news-skel"></div>
      <div class="skeleton news-skel"></div>
    } @else if (news()!.length === 0) {
      <div class="empty-state">
        <raf-icon class="float" name="bell" [size]="80" />
        <div class="empty-title">Pas encore d'actualité</div>
        <div class="empty-text">Les nouvelles de l'équipe RAF apparaîtront ici.</div>
      </div>
    } @else {
      <div class="list stagger">
        @for (n of news(); track n.id) {
          <article class="news">
            @if (n.imageUrl; as url) {
              <img class="news-img" [src]="url" alt="" loading="lazy" />
            }
            <div class="news-body">
              <div class="news-meta">
                @if (n.pinned) {
                  <span class="status-tag running">À la une</span>
                }
                <span>{{ n.publishedAt | date }}</span>
              </div>
              <h3 class="news-title">{{ n.title }}</h3>
              <p #text class="news-text" [class.clamped]="!expanded().has(n.id)">{{ n.body }}</p>
              <!-- Seulement si le texte depasse vraiment les 4 lignes affichees. -->
              @if (expanded().has(n.id) || overflows(text)) {
                <button class="more" type="button" (click)="toggle(n.id)">
                  {{ expanded().has(n.id) ? 'Réduire' : 'Lire la suite' }}
                </button>
              }
            </div>
          </article>
        }
      </div>
      @if (hasMore()) {
        <button class="btn3d blue block more-news" type="button" [disabled]="loadingMore()" (click)="loadMore()">
          {{ loadingMore() ? 'Chargement…' : 'Voir plus' }}
        </button>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .stats { margin-top: 30px; margin-bottom: 8px; }
    .stats-empty { margin: 4px 0 0; text-align: center; font-weight: 800; color: var(--raf-ink-soft); }
    .stats-skel { height: 220px; }
    .streak {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      margin-bottom: 12px;
      border-radius: 18px;
      background: var(--raf-p50);
      border: 3px solid var(--raf-p200);
      filter: saturate(0.4);
      &.on {
        filter: none;
        background: linear-gradient(180deg, #ffad47, #ff8f00);
        border-color: #a85f00;
        color: #fff;
        .streak-label { color: #fff; opacity: 0.9; }
      }
    }
    .streak-value {
      font-family: var(--raf-font-display);
      font-size: 24px;
      line-height: 1;
    }
    .streak-label { font-weight: 800; font-size: 13px; color: var(--raf-ink-soft); }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 10px 4px;
      border-radius: 16px;
      background: #fff;
      border: 3px solid var(--raf-p200);
      box-shadow: 0 3px 0 var(--raf-p300);
      text-align: center;
    }
    .value {
      font-family: var(--raf-font-display);
      font-size: 21px;
      line-height: 1.1;
      white-space: nowrap;
    }
    .label { font-weight: 800; font-size: 11.5px; color: var(--raf-ink-soft); line-height: 1.2; }
    .favorite {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      font-weight: 700;
      font-size: 14px;
      strong { font-weight: 900; }
    }

    .news-skel { height: 160px; margin-bottom: 12px; }
    .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .news {
      border-radius: 22px;
      overflow: hidden;
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      border: 3px solid var(--raf-p200);
      box-shadow: inset 0 0 0 2px #fff, 0 5px 0 var(--raf-p300), 0 10px 16px rgba(184, 106, 0, 0.18);
      color: var(--raf-ink);
    }
    .news-img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-bottom: 3px solid var(--raf-p200);
    }
    .news-body { padding: 12px 14px 14px; }
    .news-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 12.5px;
      color: var(--raf-ink-soft);
    }
    .news-title {
      margin: 6px 0 4px;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 21px;
      line-height: 1.15;
    }
    .news-text {
      margin: 0;
      font-weight: 600;
      font-size: 14.5px;
      line-height: 1.45;
      white-space: pre-line;
      overflow-wrap: anywhere;
      &.clamped {
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
    .more {
      margin-top: 6px;
      padding: 0;
      background: none;
      border: none;
      font-family: inherit;
      font-weight: 900;
      font-size: 14px;
      color: var(--raf-edge-dark);
    }
    .more-news { margin-top: 14px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsTabComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  protected readonly stats = signal<PlayerStats | null>(null);
  protected readonly statsError = signal(false);
  protected readonly news = signal<NewsItem[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly expanded = signal<Set<number>>(new Set());
  private page = 0;

  ngOnInit(): void {
    void this.load();
  }

  /** Recharge les statistiques et la premiere page d'actualites. */
  async load(): Promise<void> {
    this.error.set(null);
    this.statsError.set(false);
    // Les deux blocs sont independants : l'echec de l'un n'empeche pas l'autre.
    await Promise.all([
      firstValueFrom(this.apiService.myStats())
        .then((s) => this.stats.set(s))
        .catch(() => this.statsError.set(!this.stats())),
      firstValueFrom(this.apiService.news(0, PAGE_SIZE))
        .then((page) => {
          this.page = 0;
          this.news.set(page.content);
          this.hasMore.set(!page.last);
        })
        .catch((e) => {
          if (!this.news()) {
            this.error.set(errorMessage(e));
          }
        }),
    ]);
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    try {
      const page = await firstValueFrom(this.apiService.news(this.page + 1, PAGE_SIZE));
      this.page++;
      this.news.update((current) => [...(current ?? []), ...page.content]);
      this.hasMore.set(!page.last);
    } catch {
      // Le bouton reste affiche : le joueur peut reessayer.
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected overflows(element: HTMLElement): boolean {
    return element.scrollHeight > element.clientHeight + 1;
  }

  protected toggle(id: number): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
