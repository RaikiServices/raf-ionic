import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { TopUp } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { storage } from '../../core/storage';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { PENDING_ONLINE_TOPUP_KEY } from './online-top-up.page';

type View = 'checking' | 'confirmed' | 'failed' | 'pending' | 'cancelled' | 'unknown';

/** Relecture de la recharge tant qu'elle attend, pendant au plus {@link MAX_WAIT_MS}. */
const POLL_MS = 4_000;
const MAX_WAIT_MS = 90_000;

/*
 * Retour de la page de paiement Tranzak : recharge/retour (paiement termine) ou
 * recharge/annulee (le joueur a annule). Ces adresses sont reglees dans le
 * tableau de bord Tranzak.
 *
 * L'adresse de retour ne prouve rien : seul le serveur (webhook ou relecture
 * chez Tranzak) confirme le paiement. La page relit donc la recharge en cours
 * jusqu'a sa confirmation, son echec ou la fin de l'attente.
 */
@Component({
  selector: 'raf-top-up-return',
  imports: [IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, NumPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille" title="Recharge" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="panel panel-with-ribbon done">
          @switch (view()) {
            @case ('checking') {
              <div class="ribbon blue">Vérification</div>
              <div class="spinner" aria-hidden="true"></div>
              <p class="lead">Nous vérifions ton paiement…</p>
              <p class="sub">Ne ferme pas cette page, ça ne prend que quelques secondes.</p>
            }
            @case ('confirmed') {
              <div class="ribbon green">Recharge réussie !</div>
              <raf-icon class="pop-in" name="check" [size]="80" />
              @if (topUp(); as t) {
                <p class="lead">+{{ t.credits | num }} crédits ajoutés</p>
                <p class="sub">{{ t.chargedHtg ?? t.amountHtg | num }} HTG payés, frais compris.</p>
              }
              <button class="btn3d orange block" type="button" (click)="nav.navigateRoot('/accueil')">Jouer maintenant</button>
            }
            @case ('pending') {
              <div class="ribbon">Paiement en cours</div>
              <p class="lead">Ton paiement n'est pas encore confirmé.</p>
              <p class="sub">
                Si tu as validé le paiement, tes crédits arrivent dès sa confirmation, avec une notification.
                Aucune autre action n'est nécessaire.
              </p>
            }
            @case ('failed') {
              <div class="ribbon">Paiement non abouti</div>
              <p class="lead">Le paiement n'a pas été validé.</p>
              <p class="sub">Aucun crédit n'a été ajouté. Tu peux réessayer.</p>
              <button class="btn3d orange block" type="button" (click)="retry()">Réessayer</button>
            }
            @case ('cancelled') {
              <div class="ribbon">Paiement annulé</div>
              <p class="lead">Tu as annulé le paiement.</p>
              <p class="sub">Aucun montant n'a été débité.</p>
              <button class="btn3d orange block" type="button" (click)="retry()">Réessayer</button>
            }
            @case ('unknown') {
              <div class="ribbon">Recharge</div>
              <p class="lead">Aucune recharge en cours.</p>
              <p class="sub">Retrouve l'état de tes recharges dans l'écran Recharger.</p>
            }
          }
          <button class="btn3d blue block back-btn" type="button" (click)="nav.navigateBack('/portefeuille/recharger')">Mes recharges</button>
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .done { text-align: center; }
    .lead { font-weight: 900; font-size: 18px; margin: 12px 0 6px; }
    .sub { font-weight: 700; font-size: 14px; color: var(--raf-ink-soft); margin: 0 0 16px; }
    .back-btn { margin-top: 10px; }
    .spinner {
      width: 54px;
      height: 54px;
      margin: 10px auto 0;
      border-radius: 50%;
      border: 6px solid var(--raf-p100);
      border-top-color: var(--raf-p300);
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopUpReturnPage implements OnDestroy {
  protected readonly nav = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly state = inject(PlayerStateService);

  protected readonly view = signal<View>('checking');
  protected readonly topUp = signal<TopUp | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  async ionViewWillEnter(): Promise<void> {
    this.stop();
    const cancelled = this.route.snapshot.data['cancelled'] === true;
    const id = Number(await storage.get(PENDING_ONLINE_TOPUP_KEY));
    if (!id) {
      this.view.set(cancelled ? 'cancelled' : 'unknown');
      return;
    }
    if (cancelled) {
      // La recharge sera close par le serveur (echec ou expiration) : rien a payer.
      this.view.set('cancelled');
      await storage.remove(PENDING_ONLINE_TOPUP_KEY);
      return;
    }
    this.view.set('checking');
    this.startedAt = Date.now();
    void this.check(id);
  }

  ionViewWillLeave(): void {
    this.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected retry(): void {
    this.nav.navigateRoot('/portefeuille/recharger-en-ligne');
  }

  private async check(id: number): Promise<void> {
    try {
      const t = await firstValueFrom(this.apiService.topUp(id));
      this.topUp.set(t);
      if (t.status === 'CONFIRMED') {
        this.view.set('confirmed');
        void this.feedback.buzz('success');
        void this.state.refreshWallet();
        await storage.remove(PENDING_ONLINE_TOPUP_KEY);
        return;
      }
      if (t.status !== 'PENDING') {
        this.view.set('failed');
        await storage.remove(PENDING_ONLINE_TOPUP_KEY);
        return;
      }
    } catch {
      // Reseau coupe : on reessaie jusqu'a la fin de l'attente.
    }
    if (Date.now() - this.startedAt >= MAX_WAIT_MS) {
      this.view.set('pending');
      return;
    }
    this.timer = setTimeout(() => void this.check(id), POLL_MS);
  }

  private stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
