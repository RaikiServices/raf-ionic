import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { OnlineTopUpConfig } from '../../core/models';
import { storage } from '../../core/storage';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

/** Recharge en ligne en cours, relue par la page de retour (recharge/retour). */
export const PENDING_ONLINE_TOPUP_KEY = 'raf.pendingOnlineTopUp';

type Method = 'MONCASH' | 'NATCASH';

/*
 * Recharge en ligne : le joueur choisit MonCash ou NatCash et le montant a
 * crediter, voit les frais de la passerelle (a sa charge) puis paie sur la page
 * Tranzak. Il revient ensuite sur recharge/retour (ou recharge/annulee), qui
 * attend la confirmation du paiement.
 *
 * Le calcul des frais est refait par le serveur, qui fait foi.
 */
@Component({
  selector: 'raf-online-top-up',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, NumPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille/recharger" title="Payer en ligne" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (config(); as c) {
          @if (!c.enabled) {
            <div class="panel">
              <div class="alert-box info">Le paiement en ligne est momentanément indisponible. Réessaie plus tard.</div>
            </div>
          } @else {
            <section class="panel panel-with-ribbon">
              <div class="ribbon">Moyen de paiement</div>
              <div class="methods">
                <button type="button" class="method moncash" [class.on]="method() === 'MONCASH'" (click)="method.set('MONCASH')">MonCash</button>
                <button type="button" class="method natcash" [class.on]="method() === 'NATCASH'" (click)="method.set('NATCASH')">NatCash</button>
              </div>
            </section>

            <section class="panel panel-with-ribbon">
              <div class="ribbon green">Montant à créditer</div>
              <label class="field">
                <span class="input-box amount-box">
                  <input type="number" inputmode="numeric" name="amount" [ngModel]="amountHtg()" (ngModelChange)="amountHtg.set($event)" step="1" min="0" placeholder="0" />
                  <span class="prefix">HTG</span>
                </span>
                <span class="field-hint">De {{ c.minHtg | num }} à {{ c.maxHtg | num }} HTG · 1 crédit = {{ c.htgRate | num }} HTG</span>
              </label>
              <div class="quick">
                @for (a of quickAmounts(); track a) {
                  <button class="btn3d cream sm" type="button" (click)="amountHtg.set(a)">{{ a | num }}</button>
                }
              </div>

              @if (quote(); as q) {
                <div class="recap">
                  <div><span>Recharge</span><strong>{{ q.amountHtg | num }} HTG</strong></div>
                  <div><span>Frais {{ method() === 'MONCASH' ? 'MonCash' : 'NatCash' }} ({{ feePercent() }})</span><strong>{{ q.feeHtg | num }} HTG</strong></div>
                  <div class="net"><span>Total à payer</span><strong>{{ q.chargedHtg | num }} HTG</strong></div>
                  <div class="hint-row">
                    Environ {{ q.credits | num }} crédit(s) ajoutés à ton compte. Les gourdes qui ne forment pas
                    un crédit entier sont gardées pour ta prochaine recharge.
                  </div>
                </div>
              }

              @if (error(); as message) {
                <div class="alert-box">{{ message }}</div>
              }
              <button class="btn3d orange block" type="button" [disabled]="busy()" (click)="pay()">
                {{ busy() ? 'Redirection…' : quote() ? 'Payer ' + (quote()!.chargedHtg | num) + ' HTG' : 'Payer' }}
              </button>
              <p class="note">
                Tu vas être redirigé vers la page de paiement sécurisée. Une fois le paiement validé,
                tes crédits arrivent automatiquement, avec une notification.
              </p>
            </section>
          }
        } @else if (loadError()) {
          <div class="panel"><div class="alert-box">{{ loadError() }}</div></div>
        } @else {
          <div class="skeleton" style="height: 260px"></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .methods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .method {
      padding: 16px 10px;
      border-radius: 16px;
      border: 3px solid transparent;
      color: #fff;
      font-weight: 900;
      font-size: 17px;
      opacity: 0.55;
      &.moncash { background: linear-gradient(180deg, #ff6a5c, #d4202c); }
      &.natcash { background: linear-gradient(180deg, #ffb340, #f06a00); }
      &.on { opacity: 1; border-color: var(--raf-ink); box-shadow: 0 4px 0 var(--raf-p200); }
    }
    .amount-box input {
      font-family: var(--raf-font-display);
      font-size: 30px;
      font-weight: 400;
      text-align: right;
    }
    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: -2px 0 16px;
      button { flex: 1 0 auto; }
    }
    .recap {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
      div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 14px;
        background: #fff;
        border: 2px solid var(--raf-p100);
        font-weight: 800;
      }
      strong { font-family: var(--raf-font-display); font-weight: 400; font-size: 18px; text-align: right; }
      .net { background: var(--raf-p100); border-color: var(--raf-p300); }
      .hint-row { display: block; font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); background: #fff4e0; border-color: #ffe0a8; }
    }
    .note { margin: 12px 0 0; font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); text-align: center; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineTopUpPage {
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);

  protected readonly config = signal<OnlineTopUpConfig | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly method = signal<Method>('MONCASH');
  protected readonly amountHtg = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly quickAmounts = computed(() => {
    const c = this.config();
    return c ? [100, 250, 500, 1000].filter((a) => a >= c.minHtg && a <= c.maxHtg) : [];
  });

  protected readonly feePercent = computed(() => {
    const bps = this.config()?.feeBps ?? 0;
    return `${(bps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
  });

  /** Meme calcul que le serveur : frais = ceil(montant * p / (1 - p)). */
  protected readonly quote = computed(() => {
    const c = this.config();
    const amount = this.amountHtg();
    if (!c || amount == null || !Number.isInteger(amount) || amount <= 0) {
      return null;
    }
    const fee = c.feeBps === 0 ? 0 : Math.ceil((amount * c.feeBps) / (10_000 - c.feeBps));
    return { amountHtg: amount, feeHtg: fee, chargedHtg: amount + fee, credits: Math.floor(amount / c.htgRate) };
  });

  ionViewWillEnter(): void {
    this.error.set(null);
    this.busy.set(false);
    firstValueFrom(this.apiService.onlineTopUpConfig())
      .then((c) => {
        this.config.set(c);
        this.loadError.set(null);
      })
      .catch((e) => this.loadError.set(errorMessage(e)));
  }

  protected async pay(): Promise<void> {
    const c = this.config();
    const amount = this.amountHtg();
    if (!c || this.busy()) {
      return;
    }
    if (amount == null || !Number.isInteger(amount) || amount < c.minHtg || amount > c.maxHtg) {
      this.error.set(`Saisis un montant entier entre ${c.minHtg} et ${c.maxHtg} HTG.`);
      void this.feedback.buzz('error');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const topUp = await firstValueFrom(this.apiService.startOnlineTopUp(amount, this.method()));
      if (!topUp.paymentUrl) {
        throw new Error('Page de paiement absente');
      }
      await storage.set(PENDING_ONLINE_TOPUP_KEY, String(topUp.id));
      window.location.href = topUp.paymentUrl;
    } catch (e) {
      this.error.set(errorMessage(e));
      void this.feedback.buzz('error');
      this.busy.set(false);
    }
  }
}
