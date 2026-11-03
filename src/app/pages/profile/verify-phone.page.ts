import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

/** Verification du telephone par code SMS (requise pour retirer des gains). */
@Component({
  selector: 'raf-verify-phone',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" title="Téléphone" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="panel panel-with-ribbon center">
          <div class="ribbon purple">Vérification</div>
          <raf-icon class="float" name="phone" [size]="72" />
          @if (!auth.user()?.emailVerified) {
            <p class="text">Confirme d'abord ton adresse email avec le lien reçu, puis reviens vérifier ton numéro.</p>
            <button class="btn3d blue block" type="button" (click)="nav.navigateBack('/profil')">Retour au profil</button>
          } @else if (!sent()) {
            <p class="text">Nous allons envoyer un code par SMS au <strong>{{ auth.user()?.phone }}</strong>.</p>
            @if (error(); as message) {
              <div class="alert-box">{{ message }}</div>
            }
            <button class="btn3d purple block" type="button" [disabled]="busy()" (click)="send()">
              {{ busy() ? 'Envoi…' : 'Envoyer le code' }}
            </button>
          } @else {
            <p class="text">Saisis le code reçu au <strong>{{ auth.user()?.phone }}</strong>.</p>
            <input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" name="code" [(ngModel)]="code" placeholder="······" />
            @if (error(); as message) {
              <div class="alert-box otp-error">{{ message }}</div>
            }
            <button class="btn3d block confirm" type="button" [disabled]="busy()" (click)="verify()">
              {{ busy() ? 'Vérification…' : 'Valider' }}
            </button>
            <button class="link-btn ink" type="button" [disabled]="busy()" (click)="send()">Renvoyer le code</button>
          }
          <p class="hint">
            Mauvais numéro ?
            <button class="link-btn ink" type="button" (click)="nav.navigateForward('/profil/telephone/corriger')">Corrige-le</button>
          </p>
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .center { text-align: center; }
    .text { font-weight: 700; line-height: 1.45; margin: 12px 0 16px; }
    .otp-error { margin-top: 12px; text-align: left; }
    .confirm { margin: 16px 0 6px; }
    .hint { font-size: 12.5px; font-weight: 700; color: var(--raf-ink-soft); margin: 14px 0 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyPhonePage {
  protected readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  protected readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);

  protected code = '';

  /** L'email a pu etre confirme depuis la boite mail : on relit le compte. */
  ionViewWillEnter(): void {
    firstValueFrom(this.apiService.me())
      .then((user) => this.auth.setUser(user))
      .catch(() => undefined);
  }
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async send(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.apiService.sendPhoneOtp());
      this.sent.set(true);
      void this.feedback.toast(response.message, 'success');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async verify(): Promise<void> {
    if (!/^\d{4,8}$/.test(this.code.trim())) {
      this.error.set('Saisis le code reçu par SMS.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.apiService.verifyPhone(this.code.trim()));
      await this.auth.setUser(await firstValueFrom(this.apiService.me()));
      await this.feedback.success('Téléphone vérifié !');
      this.nav.back();
    } catch (e) {
      this.error.set(errorMessage(e));
      void this.feedback.buzz('error');
    } finally {
      this.busy.set(false);
    }
  }
}
