import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { IonModal, NavController } from '@ionic/angular/standalone';
import { filter, firstValueFrom, map } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AppNotification } from '../core/models';
import { notificationLink } from '../core/notification-links';
import { PlayerStateService } from '../core/player-state.service';
import { IconComponent } from './icon.component';
import { closeModal } from './modal';

/** Nouvelle verification des messages en attente, en plus de l'ouverture et du retour dans l'app. */
const CHECK_INTERVAL_MS = 60_000;

/** Ecrans ou le popup attend : partie chronometree en cours, suppression du compte. */
const QUIET_ROUTES = [/^\/quiz\/[^/]+\/jouer/, /^\/profil\/supprimer/];

/*
 * Messages de l'equipe RAF (envoyes depuis le back-office) a acquitter.
 *
 * A la connexion, au retour dans l'app et toutes les minutes, les messages non
 * acquittes et non expires sont recuperes, puis affiches un par un, du plus ancien
 * au plus recent. Le joueur ferme la fenetre par « J'ai compris » (le message ne
 * revient plus, sur aucun appareil) ou par « Voir » quand le message mene a un ecran.
 */
@Component({
  selector: 'raf-announcement-popup',
  imports: [IonModal, IconComponent],
  template: `
    <ion-modal class="raf-popup" [isOpen]="open()" [backdropDismiss]="false" (didDismiss)="dismissed()">
      <ng-template>
        @if (current(); as n) {
          <div class="panel popup">
            <div class="ribbon">Message de RAF</div>
            <div class="popup-art">
              <raf-icon class="float" name="info" [size]="72" />
            </div>
            <h2 class="title">{{ n.title }}</h2>
            <p class="body">{{ n.body }}</p>
            @if (remaining() > 0) {
              <p class="more">Encore {{ remaining() }} message{{ remaining() > 1 ? 's' : '' }} après celui-ci</p>
            }
            <button class="btn3d green block" type="button" [disabled]="busy()" (click)="understood()">
              <raf-icon name="check" [size]="24" /> J'ai compris
            </button>
            @if (link(); as path) {
              <button class="btn3d blue block" type="button" [disabled]="busy()" (click)="see(path)">Voir</button>
            }
          </div>
        }
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .popup { margin-top: 30px; padding-top: 26px; }
    .popup-art { display: grid; place-items: center; margin: 4px 0 10px; }
    .title { text-align: center; font-weight: 900; font-size: 19px; margin: 0 0 8px; }
    .body {
      white-space: pre-line;
      font-weight: 700;
      font-size: 15px;
      line-height: 1.4;
      margin: 0 0 14px;
      max-height: 45vh;
      overflow-y: auto;
      overflow-wrap: anywhere;
    }
    .more { text-align: center; font-size: 13px; font-weight: 700; opacity: 0.7; margin: 0 0 10px; }
    button.block + button.block { margin-top: 10px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementPopupComponent {
  private readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly state = inject(PlayerStateService);
  private readonly nav = inject(NavController);
  private readonly router = inject(Router);
  private readonly modal = viewChild(IonModal);

  private readonly queue = signal<AppNotification[]>([]);
  protected readonly current = computed(() => this.queue()[0] ?? null);
  protected readonly remaining = computed(() => Math.max(0, this.queue().length - 1));
  protected readonly link = computed(() => {
    const n = this.current();
    return n ? notificationLink(n) : null;
  });
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  /** Fermeture animee en cours : le message suivant attend qu'elle soit finie. */
  private readonly closing = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly quiet = computed(() => QUIET_ROUTES.some((r) => r.test(this.url())));

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        void this.check();
        this.timer ??= setInterval(() => void this.check(), CHECK_INTERVAL_MS);
      } else {
        this.stop();
      }
    });

    // Fenetre a afficher des qu'un message attend et que l'ecran le permet.
    effect(() => {
      if (this.current() && !this.quiet() && !this.open() && !this.closing()) {
        this.open.set(true);
      }
    });

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.auth.isLoggedIn()) {
        void this.check();
      }
    });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected async understood(): Promise<void> {
    const n = this.current();
    if (!n) {
      return;
    }
    this.busy.set(true);
    try {
      await this.acknowledge(n);
      await this.close();
    } finally {
      this.busy.set(false);
    }
  }

  protected async see(path: string): Promise<void> {
    const n = this.current();
    if (!n) {
      return;
    }
    this.busy.set(true);
    try {
      await this.acknowledge(n);
      await this.close();
      await this.nav.navigateForward(path);
    } finally {
      this.busy.set(false);
    }
  }

  /** Fenetre fermee : le message suivant s'ouvre par l'effet d'affichage. */
  protected dismissed(): void {
    this.open.set(false);
  }

  private async close(): Promise<void> {
    this.closing.set(true);
    try {
      await closeModal(this.open, this.modal());
    } finally {
      this.closing.set(false);
    }
  }

  /**
   * Retire le message de la file. Hors ligne, l'acquittement echoue : le message
   * est retire pour cette fois et reviendra a la prochaine verification.
   */
  private async acknowledge(n: AppNotification): Promise<void> {
    this.queue.update((queue) => queue.filter((q) => q.id !== n.id));
    try {
      await firstValueFrom(this.apiService.acknowledge(n.id));
      void this.state.refreshUnread();
    } catch {
      // Reessaye a la prochaine verification.
    }
  }

  private async check(): Promise<void> {
    try {
      const popups = await firstValueFrom(this.apiService.popups());
      if (!this.auth.isLoggedIn()) {
        return;
      }
      // Le message affiche reste en tete : la file ne change pas sous les yeux du joueur.
      const shown = this.open() ? this.current() : null;
      const rest = popups.filter((p) => p.id !== shown?.id);
      this.queue.set(shown ? [shown, ...rest] : rest);
    } catch {
      // Hors ligne : prochain passage.
    }
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.queue.set([]);
    void closeModal(this.open, this.modal());
  }
}
