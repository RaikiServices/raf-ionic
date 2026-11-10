import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { confirmEmailCode } from '../../core/email-verification';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Confirmation de l'email par le code a 6 chiffres recu dans l'email de RAF.
 * Le lien du meme email marche aussi : l'un ou l'autre suffit.
 */
@Component({
  selector: 'raf-verify-email-code',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" title="Email" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="panel panel-with-ribbon center">
          <div class="ribbon purple">Confirmation</div>
          <raf-icon class="float" name="mail" [size]="72" />
          @if (auth.user()?.emailVerified) {
            <p class="text">Ton adresse email est déjà confirmée.</p>
            <button class="btn3d blue block" type="button" (click)="nav.navigateBack('/profil')">Retour au profil</button>
          } @else {
            <p class="text">
              Saisis le code à 6 chiffres envoyé à <strong>{{ auth.user()?.email }}</strong>.
              Tu peux aussi toucher le lien du même email.
            </p>
            <input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" name="code"
                   [(ngModel)]="code" placeholder="······" (keyup.enter)="verify()" />
            @if (error(); as message) {
              <div class="alert-box otp-error">{{ message }}</div>
            }
            <button class="btn3d green block confirm" type="button" [disabled]="busy()" (click)="verify()">
              {{ busy() ? 'Vérification…' : 'Valider' }}
            </button>
            <button class="link-btn ink" type="button" [disabled]="resending()" (click)="resend()">Renvoyer l'email</button>
            <p class="hint">
              Pas d'email ? Regarde dans <strong>Spam</strong> ou <strong>Promotions</strong>. Mauvaise adresse ?
              <button class="link-btn ink" type="button" (click)="nav.navigateForward('/profil/email')">Corrige-la</button>
            </p>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .center { text-align: center; }
    .text { font-weight: 700; line-height: 1.45; margin: 12px 0 16px; word-break: break-word; }
    .otp-error { margin-top: 12px; text-align: left; }
    .confirm { margin: 16px 0 6px; }
    .hint { font-size: 12.5px; font-weight: 700; color: var(--raf-ink-soft); margin: 14px 0 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailCodePage {
  protected readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  protected readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);

  protected code = '';
  protected readonly busy = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Le lien a pu etre ouvert entre-temps : on relit le compte. */
  ionViewWillEnter(): void {
    firstValueFrom(this.apiService.me())
      .then((user) => this.auth.setUser(user))
      .catch(() => undefined);
  }

  protected async verify(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      this.error.set('Saisis les 6 chiffres reçus par email.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await confirmEmailCode(this.apiService, this.auth, code);
      await this.feedback.success('Email confirmé, merci !');
      this.nav.back();
    } catch (e) {
      this.error.set(errorMessage(e));
      void this.feedback.buzz('error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async resend(): Promise<void> {
    const email = this.auth.user()?.email;
    if (!email) {
      return;
    }
    this.resending.set(true);
    try {
      const response = await firstValueFrom(this.apiService.resendVerification(email));
      this.code = '';
      this.error.set(null);
      await this.feedback.success(response.message);
    } catch (e) {
      await this.feedback.error(e);
    } finally {
      this.resending.set(false);
    }
  }
}
