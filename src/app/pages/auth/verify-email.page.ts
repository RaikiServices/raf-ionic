import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorCode, errorMessage } from '../../core/errors';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

/** Lien recu par email : /verification-email?token=... */
@Component({
  selector: 'raf-verify-email',
  imports: [AuthLayoutComponent, IconComponent],
  template: `
    <raf-auth-layout ribbon="Email" helpTopic="email">
      <div class="center">
        @switch (state()) {
          @case ('pending') {
            <raf-icon class="spin" name="hourglass" [size]="64" />
            <p class="lead">Vérification en cours…</p>
          }
          @case ('ok') {
            <raf-icon class="pop-in" name="check" [size]="72" />
            <p class="lead">Adresse email confirmée !</p>
          }
          @case ('error') {
            <raf-icon class="pop-in" name="cross" [size]="72" />
            <p class="lead">{{ message() }}</p>
            <p class="hint">Tu peux demander un nouveau lien depuis ton profil.</p>
          }
        }
        @if (state() !== 'pending') {
          <button class="btn3d block" type="button" (click)="continue()">
            {{ auth.isLoggedIn() ? 'Retour au jeu' : 'Se connecter' }}
          </button>
        }
      </div>
    </raf-auth-layout>
  `,
  styles: `
    .center { text-align: center; }
    .lead { font-weight: 900; font-size: 18px; margin: 12px 0 8px; }
    .hint { font-weight: 700; color: var(--raf-ink-soft); margin: 0 0 16px; }
    .spin { animation: raf-pulse 1s ease-in-out infinite; }
    button { margin-top: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  protected readonly state = signal<'pending' | 'ok' | 'error'>('pending');
  protected readonly message = signal('');

  async ngOnInit(): Promise<void> {
    if (!this.token) {
      this.message.set('Ce lien est incomplet.');
      this.state.set('error');
      return;
    }
    try {
      await firstValueFrom(this.apiService.verifyEmail(this.token));
      this.state.set('ok');
      await this.refreshProfile();
    } catch (e) {
      if (errorCode(e) === 'EMAIL_ALREADY_VERIFIED') {
        this.state.set('ok');
        return;
      }
      this.message.set(errorMessage(e, 'Ce lien n’est plus valable.'));
      this.state.set('error');
    }
  }

  protected continue(): void {
    void this.nav.navigateRoot(this.auth.isLoggedIn() ? '/accueil' : '/connexion');
  }

  private async refreshProfile(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      try {
        await this.auth.setUser(await firstValueFrom(this.apiService.me()));
      } catch {
        // Le profil se mettra a jour a la prochaine ouverture.
      }
    }
  }
}
