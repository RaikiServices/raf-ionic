import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { WinningsConversion } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { uuid } from '../../core/uuid';
import { IconComponent } from '../../ui/icon.component';
import { NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

type Step = 'form' | 'confirm' | 'done';

/**
 * Recharge avec les gains : le joueur paie des credits avec son solde de gains (HTG).
 * Ouverte depuis l'ecran Recharger, quand les gains valent au moins un credit.
 *
 * Seules les gourdes qui forment des credits entiers sont debitees, le reste demeure
 * dans les gains. Trois etapes : saisir le montant, verifier le recapitulatif,
 * confirmer. La conversion est definitive : les credits ne se retirent pas.
 */
@Component({
  selector: 'raf-convert-winnings',
  imports: [FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, NumPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille/recharger" title="Recharger avec mes gains" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @let w = state.wallet();

        <section class="available glass">
          <raf-icon name="cash" [size]="46" />
          <div class="grow">
            <div class="label">Gains disponibles</div>
            <div class="value">{{ w ? (w.winningsBalanceHtg | num) : '…' }} HTG</div>
          </div>
          @if (w) {
            <div class="rate">1 crédit = {{ w.htgRate | num }} HTG</div>
          }
        </section>

        @if (enabled() === false) {
          <div class="panel">
            <div class="alert-box info">La recharge avec les gains est momentanément désactivée. Réessaie plus tard.</div>
          </div>
        } @else if (w) {
          @switch (step()) {
            @case ('form') {
              <section class="panel panel-with-ribbon">
                <div class="ribbon green">Montant</div>
                <label class="field">
                  <span class="input-box amount-box">
                    <input type="number" inputmode="numeric" name="amount" [ngModel]="amountHtg()" (ngModelChange)="amountHtg.set($event)" step="1" min="0" placeholder="0" />
                    <span class="prefix">HTG</span>
                  </span>
                  <span class="field-hint">Au moins {{ w.htgRate | num }} HTG pour 1 crédit.</span>
                </label>
                <div class="quick">
                  @for (p of [25, 50, 100]; track p) {
                    <button class="btn3d cream sm" type="button" (click)="setPercent(p)">{{ p === 100 ? 'Tout' : p + ' %' }}</button>
                  }
                </div>

                @if (preview(); as pv) {
                  <div class="recap">
                    <div class="net"><span>Tu reçois</span><strong>{{ pv.credits | num }} cr.</strong></div>
                    <div><span>Débité de tes gains</span><strong>{{ pv.debitedHtg | num }} HTG</strong></div>
                    @if (pv.leftoverHtg > 0) {
                      <div class="hint-row">
                        {{ pv.leftoverHtg | num }} HTG ne forment pas un crédit entier : ils restent dans tes gains.
                      </div>
                    }
                  </div>
                }

                @if (error(); as message) {
                  <div class="alert-box">{{ message }}</div>
                }
                <button class="btn3d orange block" type="button" (click)="review()">Continuer</button>
              </section>
            }

            @case ('confirm') {
              @if (preview(); as pv) {
                <section class="panel panel-with-ribbon">
                  <div class="ribbon blue">Vérification</div>
                  <div class="recap">
                    <div><span>Débité de tes gains</span><strong>{{ pv.debitedHtg | num }} HTG</strong></div>
                    <div class="net"><span>Crédits ajoutés</span><strong>+{{ pv.credits | num }} cr.</strong></div>
                    <div><span>Gains après</span><strong>{{ w.winningsBalanceHtg - pv.debitedHtg | num }} HTG</strong></div>
                    <div><span>Crédits après</span><strong>{{ w.creditBalance + pv.credits | num }} cr.</strong></div>
                  </div>
                  <div class="alert-box info">
                    Cette recharge est définitive : les crédits servent à jouer et ne peuvent pas être retirés.
                  </div>
                  @if (error(); as message) {
                    <div class="alert-box">{{ message }}</div>
                  }
                  <button class="btn3d block confirm" type="button" [disabled]="busy()" (click)="confirm()">
                    {{ busy() ? 'Conversion…' : 'Confirmer la recharge' }}
                  </button>
                  <div class="links">
                    <button class="link-btn ink" type="button" [disabled]="busy()" (click)="edit()">Modifier</button>
                  </div>
                </section>
              }
            }

            @case ('done') {
              @if (done(); as d) {
                <section class="panel panel-with-ribbon done">
                  <div class="ribbon green">Recharge réussie !</div>
                  <raf-icon class="pop-in" name="check" [size]="80" />
                  <div class="recap">
                    <div class="net"><span>Crédits ajoutés</span><strong>+{{ d.topUp.credits | num }} cr.</strong></div>
                    <div><span>Tes crédits</span><strong>{{ d.creditBalance | num }} cr.</strong></div>
                    <div><span>Tes gains</span><strong>{{ d.winningsBalanceHtg | num }} HTG</strong></div>
                  </div>
                  <button class="btn3d orange block" type="button" (click)="nav.navigateRoot('/accueil')">Jouer maintenant</button>
                  <button class="btn3d blue block back-btn" type="button" (click)="nav.navigateBack('/portefeuille')">Retour au Trésor</button>
                </section>
              }
            }
          }
        } @else {
          <div class="skeleton" style="height: 220px"></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .available {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      margin-bottom: 8px;
      .label { font-weight: 900; font-size: 12.5px; text-transform: uppercase; opacity: 0.85; }
      .value { font-family: var(--raf-font-display); font-size: 30px; line-height: 1; }
      .rate { font-weight: 900; font-size: 12.5px; text-align: right; opacity: 0.85; }
    }
    .grow { flex: 1; min-width: 0; }
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
    .confirm { margin-top: 14px; }
    .links { display: flex; justify-content: center; margin-top: 10px; }
    .done { text-align: center; }
    .done .recap { text-align: left; margin-top: 12px; }
    .back-btn { margin-top: 10px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvertWinningsPage {
  protected readonly state = inject(PlayerStateService);
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);

  protected readonly step = signal<Step>('form');
  /** Null tant qu'on ne sait pas : on ne bloque pas l'ecran sur un reglage inconnu. */
  protected readonly enabled = signal<boolean | null>(null);
  protected readonly amountHtg = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<WinningsConversion | null>(null);
  /** Une cle par conversion : un nouvel essai apres une coupure reseau n'est pas applique deux fois. */
  private requestKey: string | null = null;

  /** Ce que donnerait le montant saisi ; le serveur refait le meme calcul. */
  protected readonly preview = computed(() => {
    const w = this.state.wallet();
    const amount = this.amountHtg();
    if (!w || amount == null || !Number.isInteger(amount) || amount <= 0) {
      return null;
    }
    const credits = Math.floor(amount / w.htgRate);
    return { credits, debitedHtg: credits * w.htgRate, leftoverHtg: amount - credits * w.htgRate };
  });

  ionViewWillEnter(): void {
    void this.state.refreshWallet();
    firstValueFrom(this.apiService.appConfig())
      .then((c) => this.enabled.set(c.winningsConversionEnabled === true))
      .catch(() => this.enabled.set(null));
  }

  protected setPercent(percent: number): void {
    const wallet = this.state.wallet();
    if (wallet) {
      this.amountHtg.set(Math.floor((wallet.winningsBalanceHtg * percent) / 100));
      this.error.set(null);
    }
  }

  protected review(): void {
    const problem = this.check();
    if (problem) {
      this.error.set(problem);
      void this.feedback.buzz('error');
      return;
    }
    this.error.set(null);
    this.requestKey = uuid();
    this.step.set('confirm');
  }

  protected edit(): void {
    this.error.set(null);
    this.requestKey = null;
    this.step.set('form');
  }

  protected async confirm(): Promise<void> {
    const amount = this.amountHtg();
    if (amount == null || this.busy()) {
      return;
    }
    this.requestKey ??= uuid();
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.apiService.convertWinnings(amount, this.requestKey));
      this.done.set(result);
      this.requestKey = null;
      this.step.set('done');
      void this.feedback.buzz('success');
      void this.state.refreshWallet();
    } catch (e) {
      this.error.set(errorMessage(e));
      void this.feedback.buzz('error');
    } finally {
      this.busy.set(false);
    }
  }

  private check(): string | null {
    const w = this.state.wallet();
    const amount = this.amountHtg();
    if (!w) {
      return 'Chargement en cours, réessaie dans un instant.';
    }
    if (amount == null || !Number.isInteger(amount) || amount <= 0) {
      return 'Saisis un montant entier en HTG.';
    }
    if (amount > w.winningsBalanceHtg) {
      return `Tu n'as que ${w.winningsBalanceHtg} HTG de gains.`;
    }
    if (amount < w.htgRate) {
      return `Il faut au moins ${w.htgRate} HTG pour obtenir 1 crédit.`;
    }
    return null;
  }
}
