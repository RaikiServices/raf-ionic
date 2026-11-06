import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, Platform } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { Category, Quiz } from '../../core/models';
import { themeGradient } from '../../core/quiz-rules';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';

/** Cle du groupe des quiz dont le sujet n'a pas de categorie parente. */
const OTHERS = 'autres';

/** Quiz solo d'une meme categorie parente (Series TV : Breaking Bad, Game of Thrones...). */
interface SoloGroup {
  /** Id du parent, ou OTHERS. Sert aussi de ?categorie= dans l'URL. */
  key: string;
  id: number;
  name: string;
  imageUrl: string | null;
  quizzes: Quiz[];
  playableToday: number;
  bestPrizeHtg: number;
}

/**
 * Onglet Solo de l'accueil : les quiz solo ouverts, ranges par categorie parente de leur
 * sujet. Un clic sur une categorie affiche ses quiz dans l'onglet (?categorie= dans l'URL,
 * pour que le retour du telephone ou du navigateur ramene aux categories). Chaque partie
 * se paie au lancement, un sans-faute rapporte le prix, et chaque sujet ne se joue qu'une
 * fois par jour.
 */
@Component({
  selector: 'raf-solo-tab',
  imports: [IconComponent, NumPipe],
  template: `
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
        } @else if (current(); as group) {
          @if (groups().length > 1) {
            <button class="back" type="button" (click)="closeCategory()">
              <raf-icon name="back" [size]="22" />Toutes les catégories
            </button>
            <h2 class="group-title">{{ group.name }}</h2>
          }
          <div class="list stagger">
            @for (q of group.quizzes; track q.id) {
              <article class="card" [class.done]="played(q)" (click)="open(q, group)">
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
                <!-- La carte entiere lance la partie : pas de bouton en double. -->
                @if (played(q)) {
                  <div class="side">
                    <span class="status-tag finished">Demain</span>
                  </div>
                }
              </article>
            }
          </div>
        } @else {
          <div class="grid stagger">
            @for (g of groups(); track g.key) {
              <article class="tile" [class.done]="g.playableToday === 0" (click)="openCategory(g)">
                <div class="tile-img" [style.background]="g.imageUrl ? null : gradient(g)">
                  @if (g.imageUrl; as url) {
                    <img [src]="url" alt="" loading="lazy" />
                  } @else {
                    <raf-icon [name]="g.key === others ? 'chest' : 'flame'" [size]="48" />
                  }
                </div>
                <div class="tile-body">
                  <h3 class="tile-name">{{ g.name }}</h3>
                  <div class="tile-count">{{ g.quizzes.length }} quiz</div>
                  @if (g.playableToday > 0) {
                    <span class="chip today"><raf-icon name="play" [size]="16" />{{ g.playableToday }} à jouer aujourd'hui</span>
                  } @else {
                    <span class="chip"><raf-icon name="clock" [size]="16" />Reviens demain</span>
                  }
                  @if (g.bestPrizeHtg > 0) {
                    <div class="tile-prize"><raf-icon name="cash" [size]="20" />Jusqu'à {{ g.bestPrizeHtg | num }} HTG</div>
                  }
                </div>
              </article>
            }
          </div>
        }
  `,
  styles: `
    :host { display: block; }
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
      /* Vignette calee en haut, comme les cartes des quiz en groupe. */
      align-items: flex-start;
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
    .side { flex: none; align-self: center; }

    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 6px;
      padding: 6px 12px 6px 6px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.7);
      color: var(--raf-ink);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .group-title {
      margin: 4px 4px 12px;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 24px;
      line-height: 1.1;
    }

    /* Categories : une par ligne, chaque tuile en deux colonnes (image | infos). */
    .grid { display: flex; flex-direction: column; gap: 12px; }
    .tile {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
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
    .tile:active { transform: translateY(3px) scale(0.99); }
    .tile.done { filter: saturate(0.55); opacity: 0.85; }
    .tile-img {
      aspect-ratio: 1;
      border-radius: 16px;
      border: 3px solid #fff;
      box-shadow: 0 3px 0 rgba(184, 106, 0, 0.25);
      display: grid;
      place-items: center;
      overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .tile-body { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
    .tile-name {
      margin: 0;
      max-width: 100%;
      font-family: var(--raf-font-display);
      font-weight: 400;
      font-size: 18px;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tile-count { font-weight: 800; font-size: 13px; color: var(--raf-ink-soft); }
    .tile-body .chip { font-size: 12px; padding: 3px 8px; white-space: normal; }
    .chip.today { background: #e4f9d9; color: #1d630b; }
    .tile-prize {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: var(--raf-font-display);
      font-size: 15px;
      color: var(--raf-edge-dark);
    }

    /* Petit telephone : vignette reduite pour laisser la place au titre et au bouton. */
    @media (max-width: 380px) {
      .card { gap: 10px; padding: 8px; }
      .thumb { width: 64px; height: 64px; }
      .tile { grid-template-columns: 72px minmax(0, 1fr); gap: 10px; padding: 8px; }
      .prize { font-size: 18px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoloTabComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly others = OTHERS;
  protected readonly quizzes = signal<Quiz[] | null>(null);
  private readonly categories = signal<Category[]>([]);
  protected readonly error = signal<string | null>(null);
  /** Sujets deja joues aujourd'hui. */
  private readonly playedSubjects = signal<Set<number>>(new Set());
  /** ?categorie= de l'URL : la categorie ouverte, ou null pour la grille. */
  private readonly selectedKey = signal<string | null>(null);

  protected readonly groups = computed<SoloGroup[]>(() => {
    const byId = new Map(this.categories().map((c) => [c.id, c]));
    const groups = new Map<string, SoloGroup>();

    for (const quiz of this.quizzes() ?? []) {
      const subject = quiz.selectedCategoryId == null ? undefined : byId.get(quiz.selectedCategoryId);
      // Sans parent, ou parent desactive : le quiz rejoint « Autres ».
      const parent = subject?.parentId == null ? undefined : byId.get(subject.parentId);
      const key = parent ? String(parent.id) : OTHERS;

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          id: parent?.id ?? 0,
          name: parent?.name ?? 'Autres',
          imageUrl: parent?.imageUrl ?? null,
          quizzes: [],
          playableToday: 0,
          bestPrizeHtg: 0,
        };
        groups.set(key, group);
      }
      group.quizzes.push(quiz);
      if (!this.played(quiz)) {
        group.playableToday++;
      }
      group.bestPrizeHtg = Math.max(group.bestPrizeHtg, quiz.soloPrizeHtg ?? 0);
    }

    for (const group of groups.values()) {
      // Les sujets encore jouables aujourd'hui d'abord.
      group.quizzes.sort((a, b) => Number(this.played(a)) - Number(this.played(b)));
    }
    // Ordre alphabetique, « Autres » en dernier.
    return [...groups.values()].sort(
      (a, b) => Number(a.key === OTHERS) - Number(b.key === OTHERS) || a.name.localeCompare(b.name, 'fr'),
    );
  });

  /**
   * Groupe affiche en liste. Une seule categorie : ses quiz s'affichent directement, une
   * grille d'une seule tuile n'apporterait qu'un clic de plus.
   */
  protected readonly current = computed<SoloGroup | null>(() => {
    const groups = this.groups();
    if (groups.length === 1) {
      return groups[0];
    }
    const key = this.selectedKey();
    return groups.find((g) => g.key === key) ?? null;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      this.selectedKey.set(params.get('categorie'));
    });

    // Retour materiel Android : une categorie ouverte se referme avant de quitter l'accueil.
    // L'accueil reste en memoire sous les pages ouvertes par-dessus : n'agir que s'il est affiche.
    const backButton = inject(Platform).backButton.subscribeWithPriority(10, (next) => {
      const onHome = this.router.url.startsWith('/accueil');
      if (onHome && this.selectedKey() && this.current() && this.groups().length > 1) {
        this.closeCategory();
      } else {
        next();
      }
    });
    destroyRef.onDestroy(() => backButton.unsubscribe());
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const [page, played, categories] = await Promise.all([
        firstValueFrom(this.apiService.quizzes(0, 50, 'SOLO')),
        firstValueFrom(this.apiService.soloPlayedToday()),
        firstValueFrom(this.apiService.categories()),
      ]);
      this.playedSubjects.set(new Set(played));
      this.categories.set(categories);
      this.quizzes.set(page.content);
    } catch (e) {
      if (!this.quizzes()) {
        this.error.set(errorMessage(e));
      } else {
        void this.feedback.error(e);
      }
    }
  }

  protected played(q: Quiz): boolean {
    return q.selectedCategoryId != null && this.playedSubjects().has(q.selectedCategoryId);
  }

  protected openCategory(group: SoloGroup): void {
    this.feedback.tap();
    // Une entree d'historique : le retour du navigateur ramene a la grille.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categorie: group.key },
      queryParamsHandling: 'merge',
    });
  }

  protected closeCategory(): void {
    this.feedback.tap();
    // Remplace l'entree plutot que reculer : au retour d'une partie, reculer y ramenerait.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categorie: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected open(q: Quiz, group: SoloGroup): void {
    this.feedback.tap();
    // La partie y ramene a la fin : le joueur retrouve la categorie qu'il parcourait.
    const queryParams = this.groups().length > 1 ? { categorie: group.key } : {};
    void this.nav.navigateForward(`/quiz/${q.id}/jouer`, { queryParams });
  }

  protected gradient(item: { id: number }): string {
    return themeGradient(item);
  }
}
