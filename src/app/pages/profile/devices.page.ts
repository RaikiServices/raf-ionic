import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { DeviceSession } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe, t } from '../../core/i18n';

/** Appareils connectes au compte, a deconnecter un par un ou tous ensemble. */
@Component({
  selector: 'raf-devices',
  imports: [TPipe, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, DateTimePipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" [title]="'Appareils' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <p class="intro">{{ 'Un appareil inconnu ? Déconnecte-le, puis change ton mot de passe.' | t }}</p>
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (sessions() === null) {
          <div class="skeleton" style="height: 160px"></div>
        } @else {
          <div class="panel tight">
            @for (s of sessions(); track s.id) {
              <div class="device">
                <raf-icon name="device" [size]="36" />
                <div class="grow">
                  <div class="row-title">{{ s.deviceLabel || ('Appareil inconnu' | t) }}</div>
                  <div class="row-sub">{{ 'Actif' | t }} {{ (s.lastUsedAt || s.createdAt) | dateTime }}{{ s.ipAddress ? ' · ' + s.ipAddress : '' }}</div>
                </div>
                <button class="btn3d red sm" type="button" [disabled]="busy()" (click)="revoke(s)">{{ 'Retirer' | t }}</button>
              </div>
            } @empty {
              <p class="row-sub">{{ 'Aucune autre session.' | t }}</p>
            }
          </div>
          @if ((sessions()?.length ?? 0) > 1) {
            <button class="btn3d red block all" type="button" [disabled]="busy()" (click)="revokeAll()">{{ 'Déconnecter tous les appareils' | t }}</button>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .intro { font-weight: 800; margin: 0 4px 14px; }
    .device {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 4px;
      & + & { border-top: 2px dashed var(--raf-p100); }
    }
    .grow { flex: 1; min-width: 0; }
    .row-title { font-weight: 900; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-sub { font-weight: 700; font-size: 12.5px; color: var(--raf-ink-soft); }
    .all { margin-top: 20px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesPage {
  private readonly apiService = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  protected readonly sessions = signal<DeviceSession[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  ionViewWillEnter(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.sessions.set(await firstValueFrom(this.apiService.sessions()));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async revoke(session: DeviceSession): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.apiService.revokeSession(session.id));
      await this.feedback.success(t('Appareil déconnecté.'));
      await this.load();
    } catch (e) {
      await this.feedback.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected async revokeAll(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.apiService.revokeAllSessions());
      // Cet appareil compris : retour a l'accueil.
      await this.auth.sessionLost();
    } catch (e) {
      await this.feedback.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
