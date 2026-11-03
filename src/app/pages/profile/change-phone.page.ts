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
import { normalizePhone } from '../auth/register.page';

/**
 * Correction d'un numero mal saisi a l'inscription. Possible tant qu'il n'est pas
 * verifie : ensuite il recoit les codes de retrait, seul le support peut le changer.
 */
@Component({
  selector: 'raf-change-phone',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" title="Mon numéro" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <form class="panel panel-with-ribbon" (ngSubmit)="submit()">
          <div class="ribbon purple">Corriger mon numéro</div>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }
          @if (auth.user(); as u) {
            <div class="alert-box info">
              Numéro enregistré : <strong>{{ u.phone }}</strong>. S'il est faux, saisis le bon : c'est à lui que
              partiront le code de vérification et les codes de retrait.
            </div>
          }
          <label class="field">
            <span class="field-label">Bon numéro</span>
            <span class="input-box">
              <raf-icon name="phone" [size]="24" />
              <span class="prefix">+509</span>
              <input type="tel" name="phone" [(ngModel)]="phone" autocomplete="tel-national" inputmode="tel" placeholder="3712 3456" />
            </span>
          </label>
          <label class="field">
            <span class="field-label">Mot de passe</span>
            <span class="input-box">
              <raf-icon name="lock" [size]="24" />
              <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" />
            </span>
          </label>
          <button class="btn3d purple block" type="submit" [disabled]="busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </form>
      </div>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePhonePage {
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly nav = inject(NavController);
  protected readonly auth = inject(AuthService);

  protected phone = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    const phone = normalizePhone(this.phone);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      this.error.set('Saisis un numéro valide, par exemple 3712 3456.');
      return;
    }
    if (!this.password) {
      this.error.set('Saisis ton mot de passe pour confirmer.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const user = await firstValueFrom(this.apiService.correctPhone(this.password, phone));
      await this.auth.setUser(user);
      await this.feedback.success(`Numéro enregistré : ${user.phone}.`);
      // Email deja confirme : on enchaine sur la verification du nouveau numero.
      await this.nav.navigateBack(user.emailVerified ? '/profil/telephone' : '/profil');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
