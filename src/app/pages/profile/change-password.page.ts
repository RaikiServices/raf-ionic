import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';
import { TPipe, t } from '../../core/i18n';

/** Changement de mot de passe : le backend ferme ensuite toutes les sessions. */
@Component({
  selector: 'raf-change-password',
  imports: [TPipe, FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" [title]="'Mot de passe' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <form class="panel panel-with-ribbon" (ngSubmit)="submit()">
          <div class="ribbon purple">{{ 'Nouveau mot de passe' | t }}</div>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }
          <label class="field">
            <span class="field-label">{{ 'Mot de passe actuel' | t }}</span>
            <span class="input-box">
              <raf-icon name="lock" [size]="24" />
              <input type="password" name="current" [(ngModel)]="current" autocomplete="current-password" />
            </span>
          </label>
          <label class="field">
            <span class="field-label">{{ 'Nouveau mot de passe' | t }}</span>
            <span class="input-box">
              <raf-icon name="key" [size]="24" />
              <input type="password" name="next" [(ngModel)]="next" autocomplete="new-password" [placeholder]="'8 caractères minimum' | t" />
            </span>
          </label>
          <label class="field">
            <span class="field-label">{{ 'Confirme-le' | t }}</span>
            <span class="input-box">
              <raf-icon name="key" [size]="24" />
              <input type="password" name="confirm" [(ngModel)]="confirm" autocomplete="new-password" />
            </span>
          </label>
          <div class="alert-box info">{{ 'Par sécurité, tous tes appareils seront déconnectés : tu te reconnecteras avec le nouveau mot de passe.' | t }}</div>
          <button class="btn3d purple block" type="submit" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer') | t }}</button>
        </form>
      </div>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  private readonly apiService = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  protected current = '';
  protected next = '';
  protected confirm = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (!this.current) {
      this.error.set(t('Saisis ton mot de passe actuel.'));
      return;
    }
    if (this.next.length < 8) {
      this.error.set(t('Le nouveau mot de passe doit contenir au moins 8 caractères.'));
      return;
    }
    if (this.next !== this.confirm) {
      this.error.set(t('Les deux mots de passe ne correspondent pas.'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.apiService.changePassword(this.current, this.next));
      await this.feedback.success(response.message);
      await this.auth.logout();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
