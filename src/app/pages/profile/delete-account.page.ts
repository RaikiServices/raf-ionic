import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonModal, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { formatHtg, formatNumber } from '../../core/format';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Suppression du compte. Le backend anonymise le compte (nom, email, telephone
 * effaces) et garde l'historique des operations ; un solde restant est perdu, d'ou
 * la case a cocher quand le portefeuille n'est pas vide.
 */
@Component({
  selector: 'raf-delete-account',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, IonModal, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" title="Supprimer mon compte" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <form class="panel panel-with-ribbon" (ngSubmit)="askConfirm()">
          <div class="ribbon red">Suppression définitive</div>
          @if (error(); as message) {
            <div class="alert-box">{{ message }}</div>
          }

          <p class="lead">En supprimant ton compte :</p>
          <ul class="consequences">
            <li>ton nom, ton email et ton téléphone sont effacés ;</li>
            <li>tu ne peux plus te connecter ni récupérer ce compte ;</li>
            <li>l'historique de tes opérations est gardé, sans tes données personnelles ;</li>
            <li>tu pourras recréer un compte plus tard avec la même adresse.</li>
          </ul>

          @if (hasBalance()) {
            <div class="alert-box">
              <raf-icon name="warning" [size]="24" />
              <span>
                Il te reste {{ balanceText() }}. Ce solde sera perdu.
                Pense à retirer tes gains avant de supprimer ton compte.
              </span>
            </div>
            <label class="forfeit">
              <input type="checkbox" name="forfeit" [(ngModel)]="forfeit" />
              <span>Je renonce à mon solde.</span>
            </label>
          }

          <div class="alert-box info">Un retrait en cours doit être payé ou refusé avant la suppression.</div>

          <label class="field">
            <span class="field-label">Mot de passe</span>
            <span class="input-box">
              <raf-icon name="lock" [size]="24" />
              <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" />
            </span>
          </label>

          <button class="btn3d red block" type="submit" [disabled]="busy()">Supprimer mon compte</button>
        </form>
      </div>

      <ion-modal class="raf-popup" [isOpen]="confirmOpen()" (didDismiss)="confirmOpen.set(false)">
        <ng-template>
          <div class="panel popup">
            <div class="ribbon red">Dernière étape</div>
            <p>Ton compte sera supprimé tout de suite. Cette action est irréversible.</p>
            <button class="btn3d red block" type="button" [disabled]="busy()" (click)="submit()">
              {{ busy() ? 'Suppression…' : 'Supprimer définitivement' }}
            </button>
            <button class="btn3d blue block" type="button" [disabled]="busy()" (click)="confirmOpen.set(false)">Annuler</button>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    .lead { margin: 0 0 6px; font-weight: 800; }
    .consequences {
      margin: 0 0 16px;
      padding-left: 20px;
      font-weight: 700;
      font-size: 14px;
      line-height: 1.45;
    }
    .forfeit {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin: 0 4px 16px;
      font-weight: 800;
      font-size: 14px;
      input { flex: none; accent-color: var(--raf-red-dark); }
    }
    .popup {
      margin-top: 30px;
      display: grid;
      gap: 12px;
      p { margin: 0; font-weight: 700; text-align: center; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountPage implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly playerState = inject(PlayerStateService);

  protected password = '';
  protected forfeit = false;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmOpen = signal(false);

  private readonly wallet = this.playerState.wallet;
  protected readonly hasBalance = computed(() => {
    const w = this.wallet();
    return !!w && (w.creditBalance !== 0 || w.winningsBalanceHtg !== 0);
  });
  protected readonly balanceText = computed(() => {
    const w = this.wallet();
    if (!w) {
      return '';
    }
    const parts: string[] = [];
    if (w.creditBalance !== 0) {
      parts.push(`${formatNumber(w.creditBalance)} crédits`);
    }
    if (w.winningsBalanceHtg !== 0) {
      parts.push(`${formatHtg(w.winningsBalanceHtg)} de gains`);
    }
    return parts.join(' et ');
  });

  async ngOnInit(): Promise<void> {
    await this.playerState.refreshWallet();
  }

  protected askConfirm(): void {
    if (!this.password) {
      this.error.set('Saisis ton mot de passe pour confirmer.');
      return;
    }
    if (this.hasBalance() && !this.forfeit) {
      this.error.set('Coche la case pour confirmer que tu renonces à ton solde.');
      return;
    }
    this.error.set(null);
    this.confirmOpen.set(true);
  }

  protected async submit(): Promise<void> {
    this.busy.set(true);
    try {
      const response = await firstValueFrom(this.apiService.deleteAccount(this.password, this.forfeit));
      this.confirmOpen.set(false);
      await this.feedback.success(response.message);
      await this.auth.logout();
    } catch (e) {
      this.confirmOpen.set(false);
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
