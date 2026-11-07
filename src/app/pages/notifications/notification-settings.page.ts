import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonToggle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { openHelp } from '../../core/help';
import { InstallService } from '../../core/install.service';
import { NotificationPreference, NotificationType } from '../../core/models';
import { PushService, PushState } from '../../core/push.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

interface Row {
  type: NotificationType;
  description: string;
  email: NotificationPreference | undefined;
  push: NotificationPreference | undefined;
}

const PUSH_MESSAGES: Record<PushState, string> = {
  enabled: 'Activées sur cet appareil.',
  disabled: 'Désactivées sur cet appareil.',
  denied: 'Bloquées par le navigateur : autorise-les dans ses réglages.',
  unsupported: "Ce navigateur ne les gère pas. Installe l'application RAF sur ton écran d'accueil.",
  native: "Bientôt disponibles dans l'application. En attendant, tes alertes sont dans l'onglet Alertes.",
  'not-configured': 'Pas encore configurées sur le serveur.',
};

/** Choix des canaux (email, push) type par type ; l'historique dans l'application est toujours garde. */
@Component({
  selector: 'raf-notification-settings',
  imports: [IonHeader, IonToolbar, IonContent, IonToggle, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/alertes" title="Réglages" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="panel panel-with-ribbon">
          <div class="ribbon blue">Sur cet appareil</div>
          <div class="device">
            <raf-icon name="bell" [size]="40" />
            <div class="grow">
              <div class="row-title">Notifications push</div>
              <div class="row-sub">{{ pushMessage() }}</div>
            </div>
            @if (pushState() === 'enabled' || pushState() === 'disabled') {
              <ion-toggle [checked]="pushState() === 'enabled'" [disabled]="pushBusy()" (ionChange)="togglePush($event.detail.checked)" aria-label="Notifications push" />
            }
          </div>
          @if (pushState() !== 'enabled') {
            <button class="link-btn ink help" type="button" (click)="help()">Je n'arrive pas à les activer</button>
          }
          @if (pushState() === 'unsupported' && !installed()) {
            <button class="btn3d green block install" type="button" (click)="nav.navigateForward('/installer')">
              <raf-icon name="phone" [size]="24" /> Comment installer RAF
            </button>
          }
        </section>

        <section class="panel panel-with-ribbon">
          <div class="ribbon">Par type d'alerte</div>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          } @else if (rows().length === 0) {
            <div class="skeleton" style="height: 200px"></div>
          } @else {
            <div class="head">
              <span class="grow"></span>
              <span class="col">Email</span>
              <span class="col">Push</span>
            </div>
            @for (r of rows(); track r.type) {
              <div class="pref">
                <span class="grow">{{ r.description }}</span>
                <span class="col">
                  @if (r.email; as p) {
                    <ion-toggle [checked]="p.enabled" (ionChange)="set(p, $event.detail.checked)" [attr.aria-label]="r.description + ' par email'" />
                  }
                </span>
                <span class="col">
                  @if (r.push; as p) {
                    <ion-toggle [checked]="p.enabled" (ionChange)="set(p, $event.detail.checked)" [attr.aria-label]="r.description + ' en push'" />
                  }
                </span>
              </div>
            }
            <p class="note">Toutes tes alertes restent visibles dans l'onglet Alertes, quels que soient ces réglages.</p>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .device { display: flex; align-items: center; gap: 12px; }
    .grow { flex: 1; min-width: 0; }
    .install { margin-top: 12px; }
    .help { display: block; margin: 8px auto 0; }
    .row-title { font-weight: 900; }
    .row-sub { font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); }
    .head, .pref {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .head {
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--raf-ink-soft);
      padding-bottom: 6px;
    }
    .pref {
      padding: 10px 0;
      border-top: 2px dashed var(--raf-p100);
      font-weight: 800;
      font-size: 14.5px;
    }
    .col { width: 58px; display: flex; justify-content: center; flex: none; }
    .note { font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); margin: 12px 0 0; }
    ion-toggle {
      --track-background-checked: var(--raf-primary);
      --handle-background-checked: #fff;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSettingsPage {
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly push = inject(PushService);
  protected readonly nav = inject(NavController);
  private readonly install = inject(InstallService);
  protected readonly installed = computed(() => this.install.mode() === 'installed');

  protected readonly prefs = signal<NotificationPreference[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly pushState = signal<PushState>('unsupported');
  protected readonly pushBusy = signal(false);
  protected readonly pushMessage = computed(() => PUSH_MESSAGES[this.pushState()]);

  protected readonly rows = computed<Row[]>(() => {
    const rows = new Map<NotificationType, Row>();
    for (const p of this.prefs()) {
      if (p.type === 'ADMIN_RECONCILIATION_ALERT') {
        continue;
      }
      const row = rows.get(p.type) ?? { type: p.type, description: p.description, email: undefined, push: undefined };
      if (p.channel === 'EMAIL') {
        row.email = p;
      } else if (p.channel === 'PUSH') {
        row.push = p;
      }
      rows.set(p.type, row);
    }
    return [...rows.values()];
  });

  ionViewWillEnter(): void {
    firstValueFrom(this.apiService.preferences())
      .then((p) => this.prefs.set(p))
      .catch((e) => this.error.set(errorMessage(e)));
    void this.push.state().then((s) => this.pushState.set(s));
  }

  protected async set(pref: NotificationPreference, enabled: boolean): Promise<void> {
    try {
      this.prefs.set(
        await firstValueFrom(this.apiService.updatePreferences([{ type: pref.type, channel: pref.channel, enabled }])),
      );
    } catch (e) {
      await this.feedback.error(e);
    }
  }

  protected help(): void {
    openHelp('notifications');
  }

  protected async togglePush(on: boolean): Promise<void> {
    this.pushBusy.set(true);
    try {
      this.pushState.set(on ? await this.push.enable() : await this.push.disable());
    } catch (e) {
      this.pushState.set(await this.push.state());
      await this.feedback.error(e);
    } finally {
      this.pushBusy.set(false);
    }
  }
}
