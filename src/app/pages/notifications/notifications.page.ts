import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { AppNotification } from '../../core/models';
import { notificationIcon, notificationLink } from '../../core/notification-links';
import { PlayerStateService } from '../../core/player-state.service';
import { PushService, PushState } from '../../core/push.service';
import { IconComponent } from '../../ui/icon.component';
import { AgoPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe, t } from '../../core/i18n';

/** Alertes : historique des notifications, et invitation a activer le push. */
@Component({
  selector: 'raf-notifications',
  imports: [TPipe, 
    IonHeader,
    IonToolbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TopBarComponent,
    IconComponent,
    AgoPipe,
  ],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar [title]="'Alertes' | t" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-pad">
        @if (pushState() === 'disabled') {
          <section class="push glass slide-up">
            <raf-icon class="float" name="bell" [size]="48" />
            <div class="grow">
              <strong>{{ 'Ne rate aucun quiz' | t }}</strong>
              <span>{{ 'Sois prévenu au démarrage, à la clôture et quand tu gagnes.' | t }}</span>
            </div>
            <button class="btn3d sm" type="button" [disabled]="pushBusy()" (click)="enablePush()">{{ 'Activer' | t }}</button>
          </section>
        }

        <div class="toolbar">
          <button class="btn3d cream sm" type="button" (click)="nav.navigateForward('/alertes/reglages')">
            <raf-icon name="settings" [size]="20" /> {{ 'Réglages' | t }}
          </button>
          @if (state.unread() > 0) {
            <button class="btn3d blue sm" type="button" (click)="readAll()">{{ 'Tout marquer lu' | t }}</button>
          }
        </div>

        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (items() === null) {
          <div class="skeleton" style="height: 220px"></div>
        } @else if (items()!.length === 0) {
          <div class="empty-state">
            <raf-icon class="float" name="bell" [size]="88" />
            <div class="empty-title">{{ 'Rien de neuf' | t }}</div>
            <div class="empty-text">{{ 'Tes alertes de quiz, de gains et de retraits apparaîtront ici.' | t }}</div>
          </div>
        } @else {
          <div class="list">
            @for (n of items(); track n.id) {
              <button class="note" type="button" [class.unread]="!n.read" (click)="open(n)">
                <raf-icon [name]="icon(n)" [size]="40" />
                <span class="grow">
                  <span class="title">{{ n.title }}</span>
                  <span class="body">{{ n.body }}</span>
                  <span class="when">{{ n.createdAt | ago }}</span>
                </span>
                @if (!n.read) {
                  <span class="dot"></span>
                }
              </button>
            }
          </div>
          <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="more($event)">
            <ion-infinite-scroll-content />
          </ion-infinite-scroll>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .push {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      margin-bottom: 14px;
      strong { display: block; font-family: var(--raf-font-display); font-weight: 400; font-size: 18px; }
      span { font-weight: 700; font-size: 13px; color: var(--raf-ink-soft); }
    }
    .grow { flex: 1; min-width: 0; }
    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }
    .list { display: grid; gap: 10px; }
    .note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.86);
      border: 2px solid var(--raf-p100);
      box-shadow: 0 3px 0 var(--raf-p200);
      color: var(--raf-ink);
      text-align: left;
      font-family: inherit;
      cursor: pointer;
      &.unread {
        background: linear-gradient(180deg, #ffffff, var(--raf-p100));
        border-color: var(--raf-primary);
        box-shadow: 0 3px 0 var(--raf-edge);
      }
      .grow { display: flex; flex-direction: column; gap: 2px; }
    }
    .title { font-weight: 900; font-size: 15px; }
    .body { font-weight: 700; font-size: 13.5px; color: var(--raf-ink-soft); line-height: 1.35; }
    .when { font-weight: 800; font-size: 11.5px; color: var(--raf-ink-soft); margin-top: 2px; }
    .dot {
      width: 12px;
      height: 12px;
      flex: none;
      margin-top: 4px;
      border-radius: 50%;
      background: #ff5468;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px #ff5468;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  protected readonly nav = inject(NavController);
  protected readonly state = inject(PlayerStateService);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly push = inject(PushService);

  protected readonly items = signal<AppNotification[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly pushState = signal<PushState>('unsupported');
  protected readonly pushBusy = signal(false);
  private page = 0;

  ionViewWillEnter(): void {
    void this.load();
    void this.push.state().then((s) => this.pushState.set(s));
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  private async load(): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.notifications(0, 20));
      this.page = 0;
      this.items.set(page.content);
      this.hasMore.set(!page.last);
      this.error.set(null);
      void this.state.refreshUnread();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async more(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.notifications(this.page + 1, 20));
      this.page++;
      this.items.update((list) => [...(list ?? []), ...page.content]);
      this.hasMore.set(!page.last);
    } finally {
      await event.target.complete();
    }
  }

  protected icon(n: AppNotification): string {
    return notificationIcon(n);
  }

  protected async open(n: AppNotification): Promise<void> {
    if (!n.read) {
      this.items.update((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      this.state.unread.update((count) => Math.max(0, count - 1));
      firstValueFrom(this.apiService.markRead(n.id)).catch(() => undefined);
    }
    const link = notificationLink(n);
    if (link) {
      await this.nav.navigateForward(link);
    }
  }

  protected async readAll(): Promise<void> {
    try {
      await firstValueFrom(this.apiService.markAllRead());
      this.items.update((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
      this.state.unread.set(0);
    } catch (e) {
      await this.feedback.error(e);
    }
  }

  protected async enablePush(): Promise<void> {
    this.pushBusy.set(true);
    try {
      const result = await this.push.enable();
      this.pushState.set(result);
      if (result === 'enabled') {
        await this.feedback.success(t('Notifications activées !'));
      } else {
        await this.feedback.toast(t('Les notifications push ne sont pas encore configurées sur le serveur.'));
      }
    } catch (e) {
      this.pushState.set(await this.push.state());
      if (this.pushState() === 'denied') {
        await this.feedback.toast(t('Notifications bloquées : autorise-les dans les réglages du navigateur.'), 'error');
      } else {
        await this.feedback.error(e);
      }
    } finally {
      this.pushBusy.set(false);
    }
  }
}
