import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, NavController } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';
import { TPipe, t } from '../../core/i18n';

@Component({
  selector: 'raf-login',
  imports: [TPipe, FormsModule, IonIcon, AuthLayoutComponent, IconComponent],
  template: `
    <raf-auth-layout [ribbon]="'Connexion' | t" ribbonColor="blue" backTo="/bienvenue">
      <form (ngSubmit)="submit()" [class.shake]="shake()">
        @if (error(); as message) {
          <div class="alert-box">{{ message }}</div>
        }
        <label class="field">
          <span class="field-label">{{ 'Email' | t }}</span>
          <span class="input-box">
            <raf-icon name="mail" [size]="24" />
            <input type="email" name="email" [(ngModel)]="email" autocomplete="email" inputmode="email" [placeholder]="'toi@exemple.com' | t" required />
          </span>
        </label>
        <label class="field">
          <span class="field-label">{{ 'Mot de passe' | t }}</span>
          <span class="input-box">
            <raf-icon name="key" [size]="24" />
            <input [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" autocomplete="current-password" placeholder="••••••••" required />
            <button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="(showPassword() ? 'Masquer' : 'Afficher') | t">
              <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'" />
            </button>
          </span>
        </label>
        <button class="btn3d block lg" type="submit" [disabled]="busy()">
          {{ (busy() ? 'Connexion…' : 'Jouer') | t }}
        </button>
        <div class="links">
          <button class="link-btn ink" type="button" (click)="nav.navigateForward('/mot-de-passe-oublie')">{{ 'Mot de passe oublié ?' | t }}</button>
        </div>
      </form>
      <div below class="below">
        <span>{{ 'Pas encore de compte ?' | t }}</span>
        <button class="btn3d orange sm" type="button" (click)="nav.navigateForward('/inscription')">{{ 'Créer un compte' | t }}</button>
      </div>
    </raf-auth-layout>
  `,
  styles: `
    .links { text-align: center; margin-top: 12px; }
    .below {
      margin-top: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-weight: 800;
      flex-wrap: wrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  protected readonly nav = inject(NavController);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  protected email = '';
  protected password = '';
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly shake = signal(false);

  protected async submit(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.fail(t('Renseigne ton email et ton mot de passe.'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      void this.feedback.buzz('success');
      await this.nav.navigateRoot('/accueil', { animationDirection: 'forward' });
    } catch (e) {
      this.fail(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private fail(message: string): void {
    this.error.set(message);
    void this.feedback.buzz('error');
    this.shake.set(false);
    setTimeout(() => this.shake.set(true));
  }
}
