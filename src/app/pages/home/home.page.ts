import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { FeedbackService } from '../../core/feedback.service';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';
import { GroupTabComponent } from './group-tab.component';
import { NewsTabComponent } from './news-tab.component';
import { SoloTabComponent } from './solo-tab.component';

/**
 * Onglets de l'accueil, dans l'ordre d'affichage. La cle est celle du parametre
 * ?onglet= de l'URL (ex. /accueil?onglet=solo) : ne pas la renommer sans les liens
 * qui y menent. Pour ajouter un onglet : une entree ici et un cas dans le @switch.
 */
export const HOME_TABS = [
  { key: 'actualite', label: 'Actualité', icon: 'bell' },
  { key: 'groupe', label: 'En groupe', icon: 'users' },
  { key: 'solo', label: 'Solo', icon: 'flame' },
] as const;

export type HomeTabKey = (typeof HOME_TABS)[number]['key'];

const DEFAULT_TAB: HomeTabKey = 'actualite';

function isTab(value: string | null): value is HomeTabKey {
  return HOME_TABS.some((tab) => tab.key === value);
}

/** Accueil : un systeme d'onglets (Actualite, En groupe, Solo). */
@Component({
  selector: 'raf-home',
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    TopBarComponent,
    IconComponent,
    GroupTabComponent,
    SoloTabComponent,
    NewsTabComponent,
  ],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-pad">
        <h1 class="hello title-stroke">Salut {{ auth.user()?.firstName }} !</h1>

        <nav class="home-tabs" role="tablist" aria-label="Accueil">
          @for (tab of tabs; track tab.key) {
            <button type="button" role="tab" class="home-tab" [class.active]="active() === tab.key"
                    [attr.aria-selected]="active() === tab.key" (click)="select(tab.key)">
              <raf-icon [name]="tab.icon" [size]="24" />
              <span>{{ tab.label }}</span>
            </button>
          }
        </nav>

        @switch (active()) {
          @case ('actualite') {
            <raf-news-tab />
          }
          @case ('groupe') {
            <raf-group-tab />
          }
          @case ('solo') {
            <raf-solo-tab />
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .hello {
      font-size: 28px;
      margin: 6px 4px 14px;
    }
    // Onglets facon jeu : pastilles creme, l'active orange et soulevee. Defilement
    // horizontal si d'autres onglets s'ajoutent.
    .home-tabs {
      display: flex;
      gap: 8px;
      margin: 0 -4px 18px;
      padding: 4px 4px 8px;
      overflow-x: auto;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }
    .home-tab {
      flex: 1 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 46px;
      padding: 6px 14px;
      border-radius: 16px;
      border: 3px solid var(--raf-p200);
      background: linear-gradient(180deg, #ffffff, var(--raf-p50));
      box-shadow: 0 4px 0 var(--raf-p300);
      font-family: var(--raf-font-display);
      font-size: 16px;
      color: var(--raf-ink-soft);
      white-space: nowrap;
      transition: transform 0.15s ease;
      &:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--raf-p300); }
      &.active {
        color: #fff;
        border-color: #fff;
        background: linear-gradient(180deg, #ffc078 0%, #ff9a1a 100%);
        box-shadow: 0 4px 0 var(--raf-edge-dark), 0 0 16px rgba(255, 154, 26, 0.45);
        -webkit-text-stroke: 3px var(--raf-edge-dark);
        paint-order: stroke fill;
      }
    }
    @media (max-width: 360px) {
      .home-tab { padding: 6px 10px; font-size: 14.5px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly state = inject(PlayerStateService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs = HOME_TABS;
  protected readonly active = signal<HomeTabKey>(DEFAULT_TAB);

  private readonly newsTab = viewChild(NewsTabComponent);
  private readonly groupTab = viewChild(GroupTabComponent);
  private readonly soloTab = viewChild(SoloTabComponent);
  /** Le premier affichage charge deja l'onglet (a sa creation) : pas de second appel. */
  private entered = false;

  constructor() {
    // /accueil?onglet=solo (retour d'une partie solo, lien) ouvre l'onglet demande.
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      const requested = params.get('onglet');
      if (isTab(requested)) {
        this.active.set(requested);
      }
    });
  }

  /** Retour sur l'accueil : l'onglet affiche se met a jour. */
  ionViewWillEnter(): void {
    if (this.entered) {
      void this.reloadActive();
    }
    this.entered = true;
  }

  protected select(key: HomeTabKey): void {
    if (key === this.active()) {
      return;
    }
    this.feedback.tap();
    this.active.set(key);
    // Garde l'onglet dans l'URL sans empiler l'historique.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { onglet: key === DEFAULT_TAB ? null : key },
      replaceUrl: true,
    });
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await Promise.all([this.reloadActive(), this.state.refreshWallet()]);
    await event.target.complete();
  }

  private reloadActive(): Promise<void> {
    switch (this.active()) {
      case 'actualite':
        return this.newsTab()?.load() ?? Promise.resolve();
      case 'groupe':
        return this.groupTab()?.load() ?? Promise.resolve();
      case 'solo':
        return this.soloTab()?.load() ?? Promise.resolve();
    }
  }
}
