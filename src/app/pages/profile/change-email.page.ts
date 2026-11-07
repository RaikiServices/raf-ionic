import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { suggestEmail } from '../../core/email-typo';
import { FeedbackService } from '../../core/feedback.service';
import { EmailSuggestionComponent } from '../../ui/email-suggestion.component';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Correction d'une adresse email mal saisie a l'inscription. Possible tant qu'elle
 * n'est pas verifiee ; ensuite, seul le support peut la changer.
 */
@Component({
  selector: 'raf-change-email',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, EmailSuggestionComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" title="Mon email" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <form class="panel panel-with-ribbon" (ngSubmit)="submit()">
          <div class="ribbon blue">Corriger mon email</div>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }
          @if (auth.user(); as u) {
            <div class="alert-box info stack">
              <span>Le lien de confirmation a été envoyé à</span>
              <strong>{{ u.email }}</strong>
              <span>Si cette adresse est fausse, saisis la bonne : on t'enverra un nouveau lien.</span>
            </div>
          }
          <label class="field">
            <span class="field-label">Bonne adresse email</span>
            <span class="input-box">
              <raf-icon name="mail" [size]="24" />
              <input type="email" name="email" [(ngModel)]="email" autocomplete="email" inputmode="email" (blur)="checkEmail()" />
            </span>
            @if (emailSuggestion(); as suggestion) {
              <raf-email-suggestion [suggestion]="suggestion" (accept)="acceptEmail($event)" (keep)="keepEmail()" />
            }
          </label>
          <label class="field">
            <span class="field-label">Mot de passe</span>
            <span class="input-box">
              <raf-icon name="lock" [size]="24" />
              <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" />
            </span>
          </label>
          <button class="btn3d blue block" type="submit" [disabled]="busy()">{{ busy() ? 'Envoi…' : 'Enregistrer et renvoyer le lien' }}</button>
        </form>
      </div>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeEmailPage {
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly nav = inject(NavController);
  protected readonly auth = inject(AuthService);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly emailSuggestion = signal<string | null>(null);
  private keptEmail: string | null = null;

  protected checkEmail(): void {
    const email = this.email.trim();
    this.emailSuggestion.set(email && email !== this.keptEmail ? suggestEmail(email) : null);
  }

  protected acceptEmail(suggestion: string): void {
    this.email = suggestion;
    this.emailSuggestion.set(null);
    this.error.set(null);
  }

  protected keepEmail(): void {
    this.keptEmail = this.email.trim();
    this.emailSuggestion.set(null);
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    const email = this.email.trim();
    this.checkEmail();
    if (this.emailSuggestion()) {
      this.error.set('Vérifie ton adresse email : elle contient peut-être une faute.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Saisis une adresse email valide.');
      return;
    }
    if (!this.password) {
      this.error.set('Saisis ton mot de passe pour confirmer.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const user = await firstValueFrom(this.apiService.correctEmail(this.password, email));
      await this.auth.setUser(user);
      await this.feedback.success(`Adresse enregistrée. Ouvre le lien envoyé à ${user.email}.`);
      await this.nav.navigateBack('/profil');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
