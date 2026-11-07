import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

/** Lien recu par email : /nouveau-mot-de-passe?token=... */
@Component({
  selector: 'raf-reset-password',
  imports: [FormsModule, AuthLayoutComponent, IconComponent],
  template: `
    <raf-auth-layout ribbon="Nouveau mot de passe" ribbonColor="purple" helpTopic="mot-de-passe">
      @if (done()) {
        <div class="center">
          <raf-icon class="pop-in" name="check" [size]="72" />
          <p class="lead">Mot de passe mis à jour !</p>
          <p class="hint">Toutes tes sessions ont été fermées. Reconnecte-toi avec ton nouveau mot de passe.</p>
          <button class="btn3d block" type="button" (click)="nav.navigateRoot('/connexion')">Se connecter</button>
        </div>
      } @else if (!token) {
        <div class="alert-box">Ce lien est incomplet. Ouvre directement le lien reçu par email, ou demandes-en un nouveau.</div>
        <button class="btn3d purple block" type="button" (click)="nav.navigateRoot('/mot-de-passe-oublie')">Recevoir un nouveau lien</button>
      } @else {
        <form (ngSubmit)="submit()">
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }
          <label class="field">
            <span class="field-label">Nouveau mot de passe</span>
            <span class="input-box">
              <raf-icon name="key" [size]="24" />
              <input type="password" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="8 caractères minimum" />
            </span>
          </label>
          <label class="field">
            <span class="field-label">Confirme-le</span>
            <span class="input-box">
              <raf-icon name="key" [size]="24" />
              <input type="password" name="confirm" [(ngModel)]="confirm" autocomplete="new-password" />
            </span>
          </label>
          <button class="btn3d purple block" type="submit" [disabled]="busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </form>
      }
    </raf-auth-layout>
  `,
  styles: `
    .center { text-align: center; }
    .lead { font-weight: 900; font-size: 18px; margin: 12px 0 8px; }
    .hint { font-weight: 700; color: var(--raf-ink-soft); margin: 0 0 16px; line-height: 1.4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected password = '';
  protected confirm = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected async submit(): Promise<void> {
    if (this.password.length < 8) {
      this.error.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.apiService.resetPassword(this.token!, this.password));
      // Le backend ferme toutes les sessions : celle de cet appareil aussi.
      if (this.auth.isLoggedIn()) {
        await this.auth.logout();
        return;
      }
      this.done.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
