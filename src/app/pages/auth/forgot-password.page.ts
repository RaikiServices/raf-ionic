import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'raf-forgot-password',
  imports: [FormsModule, AuthLayoutComponent, IconComponent],
  template: `
    <raf-auth-layout ribbon="Mot de passe oublié" ribbonColor="purple" backTo="/connexion" helpTopic="mot-de-passe">
      @if (sent(); as message) {
        <div class="center">
          <raf-icon class="pop-in" name="mail" [size]="72" />
          <p class="lead">{{ message }}</p>
          <p class="hint">Ouvre le lien reçu par email pour choisir un nouveau mot de passe. Pense à regarder dans les indésirables.</p>
          <button class="btn3d blue block" type="button" (click)="nav.navigateBack('/connexion')">Retour à la connexion</button>
        </div>
      } @else {
        <form (ngSubmit)="submit()">
          <p class="hint">Indique l'email de ton compte : nous t'enverrons un lien pour choisir un nouveau mot de passe.</p>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }
          <label class="field">
            <span class="field-label">Email</span>
            <span class="input-box">
              <raf-icon name="mail" [size]="24" />
              <input type="email" name="email" [(ngModel)]="email" autocomplete="email" inputmode="email" required />
            </span>
          </label>
          <button class="btn3d purple block" type="submit" [disabled]="busy()">{{ busy() ? 'Envoi…' : 'Envoyer le lien' }}</button>
        </form>
      }
    </raf-auth-layout>
  `,
  styles: `
    .center { text-align: center; }
    .lead { font-weight: 900; font-size: 17px; margin: 12px 0 8px; }
    .hint { font-weight: 700; color: var(--raf-ink-soft); margin: 0 0 16px; line-height: 1.4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);

  protected email = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (!this.email.trim()) {
      this.error.set('Indique ton email.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      this.sent.set((await firstValueFrom(this.apiService.forgotPassword(this.email))).message);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
