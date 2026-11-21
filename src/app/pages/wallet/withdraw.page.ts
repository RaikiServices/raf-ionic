import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { CodeChannel, PaymentProvider, PayoutConfig, Withdrawal } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';
import { HtgPipe, NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';
import { normalizePhone } from '../auth/register.page';
import { TPipe, t } from '../../core/i18n';

type Step = 'form' | 'otp' | 'done';

const PROVIDERS: { value: PaymentProvider; label: string; sub: string }[] = [
  { value: 'MONCASH', label: 'MonCash', sub: 'Sur ton compte MonCash' },
  { value: 'NATCASH', label: 'NatCash', sub: 'Sur ton compte NatCash' },
  { value: 'MANUAL', label: 'Espèces', sub: 'Au guichet RAF' },
];

/**
 * Retrait des gains : montant, moyen de paiement, puis code de confirmation par SMS,
 * ou par email quand le back-office a active ce secours (SMS indisponibles).
 */
@Component({
  selector: 'raf-withdraw',
  imports: [TPipe, FormsModule, IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, NumPipe, HtgPipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille" [title]="'Retirer' | t" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @let w = state.wallet();

        <section class="available glass">
          <raf-icon name="cash" [size]="46" />
          <div>
            <div class="label">{{ 'Gains disponibles' | t }}</div>
            <div class="value">{{ w ? (w.winningsBalanceHtg | num) : '…' }} HTG</div>
          </div>
        </section>

        @if (byEmail() && !auth.user()?.emailVerified) {
          <section class="panel panel-with-ribbon">
            <div class="ribbon purple">{{ 'Email à confirmer' | t }}</div>
            <p class="text">{{ "Pour protéger tes gains, chaque retrait est confirmé par un code envoyé par email. Confirme d'abord ton adresse." | t }}</p>
            <button class="btn3d purple block" type="button" (click)="nav.navigateForward('/profil/email/code')">
              <raf-icon name="mail" [size]="26" /> {{ 'Confirmer mon email' | t }}
            </button>
          </section>
        } @else if (!byEmail() && !auth.user()?.phoneVerified) {
          <section class="panel panel-with-ribbon">
            <div class="ribbon purple">{{ 'Téléphone à vérifier' | t }}</div>
            <p class="text">{{ "Pour protéger tes gains, chaque retrait est confirmé par un code SMS. Vérifie d'abord ton numéro." | t }}</p>
            <button class="btn3d purple block" type="button" (click)="nav.navigateForward('/profil/telephone')">
              <raf-icon name="phone" [size]="26" /> {{ 'Vérifier mon téléphone' | t }}
            </button>
          </section>
        } @else {
          @switch (step()) {
            @case ('form') {
              <section class="panel panel-with-ribbon">
                <div class="ribbon">{{ 'Montant' | t }}</div>
                <label class="field">
                  <span class="input-box amount-box">
                    <input type="number" inputmode="numeric" name="amount" [(ngModel)]="amountHtg" step="1" min="0" placeholder="0" />
                    <span class="prefix">HTG</span>
                  </span>
                  @if (automatic()) {
                    <span class="field-hint">{{ "Frais {moyen} : {taux}, retenus sur le montant. L'argent part dès la validation de ta demande." | t: { moyen: providerLabel(), taux: feePercent() } }}</span>
                  } @else {
                    <span class="field-hint">{{ "Des frais de retrait s'appliquent ; le montant net est affiché à la confirmation." | t }}</span>
                  }
                </label>
                <div class="quick">
                  @for (p of [25, 50, 100]; track p) {
                    <button class="btn3d cream sm" type="button" (click)="setPercent(p)">{{ p === 100 ? ('Tout' | t) : p + ' %' }}</button>
                  }
                </div>

                <h3 class="sub-title">{{ 'Recevoir sur' | t }}</h3>
                <div class="providers">
                  @for (p of providers; track p.value) {
                    <button class="provider" type="button" [class.selected]="provider() === p.value" (click)="provider.set(p.value)">
                      <span class="p-name">{{ p.label | t }}</span>
                      <span class="p-sub">{{ p.sub | t }}</span>
                    </button>
                  }
                </div>

                @if (provider() !== 'MANUAL') {
                  <label class="field">
                    <span class="field-label">{{ 'Numéro {moyen}' | t: { moyen: providerLabel() } }}</span>
                    <span class="input-box">
                      <raf-icon name="phone" [size]="24" />
                      <input type="tel" inputmode="tel" name="destination" [(ngModel)]="destination" placeholder="+509 3712 3456" />
                    </span>
                  </label>
                } @else {
                  <div class="alert-box info">{{ (byEmail() ? "Une fois ta demande approuvée, présente-toi au guichet : l'agent t'enverra un code de remise par email." : "Une fois ta demande approuvée, présente-toi au guichet : l'agent t'enverra un code de remise par SMS.") | t }}</div>
                }

                @if (error(); as message) {
                  <div class="alert-box">{{ message }}</div>
                }
                <button class="btn3d orange block" type="button" [disabled]="busy()" (click)="sendCode()">
                  {{ (busy() ? 'Envoi…' : byEmail() ? 'Recevoir le code par email' : 'Recevoir le code SMS') | t }}
                </button>
              </section>
            }

            @case ('otp') {
              <section class="panel panel-with-ribbon">
                <div class="ribbon blue">{{ 'Confirmation' | t }}</div>
                <div class="recap">
                  <div><span>{{ 'Montant' | t }}</span><strong>{{ amountHtg | htg }}</strong></div>
                  <div><span>{{ 'Vers' | t }}</span><strong>{{ providerLabel() }}{{ provider() !== 'MANUAL' ? ' · ' + destinationNormalized() : '' }}</strong></div>
                  @if (estimatedNet(); as net) {
                    <div><span>{{ 'Tu recevras environ' | t }}</span><strong>{{ net | htg }}</strong></div>
                  }
                </div>
                @if (codeChannel() === 'EMAIL') {
                  <p class="text">{{ 'Saisis le code reçu par email à {email}. Pense à regarder dans les spams.' | t: { email: auth.user()?.email ?? '' } }}</p>
                } @else {
                  <p class="text">{{ 'Saisis le code reçu par SMS au {tel}.' | t: { tel: auth.user()?.phone ?? '' } }}</p>
                }
                <input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" name="otp" [(ngModel)]="otp" placeholder="······" />
                @if (error(); as message) {
                  <div class="alert-box otp-error">{{ message }}</div>
                }
                <button class="btn3d block confirm" type="button" [disabled]="busy()" (click)="confirm()">
                  {{ (busy() ? 'Envoi…' : 'Confirmer le retrait') | t }}
                </button>
                <div class="links">
                  <button class="link-btn ink" type="button" (click)="step.set('form')">{{ 'Modifier' | t }}</button>
                  <button class="link-btn ink" type="button" [disabled]="busy()" (click)="sendCode()">{{ 'Renvoyer le code' | t }}</button>
                </div>
              </section>
            }

            @case ('done') {
              @if (done(); as d) {
                <section class="panel panel-with-ribbon done">
                  <div class="ribbon green">{{ 'Demande envoyée !' | t }}</div>
                  <raf-icon class="pop-in" name="check" [size]="80" />
                  <div class="recap">
                    <div><span>{{ 'Montant' | t }}</span><strong>{{ d.amountHtg | htg }}</strong></div>
                    <div><span>{{ 'Frais' | t }}</span><strong>{{ d.feeHtg | htg }}</strong></div>
                    <div class="net"><span>{{ 'Tu recevras' | t }}</span><strong>{{ d.netHtg | htg }}</strong></div>
                  </div>
                  <p class="text">
                    @if (d.provider === 'MANUAL') {
                      {{ (byEmail() ? "Un administrateur valide ta demande. Ensuite, présente-toi au guichet RAF : l'agent t'enverra un code de remise par email." : "Un administrateur valide ta demande. Ensuite, présente-toi au guichet RAF : l'agent t'enverra un code de remise par SMS.") | t }}
                    } @else {
                      @if (d.automaticPayout) {
                        {{ "Dès qu'un administrateur valide ta demande, le montant part automatiquement sur ton compte {moyen}. Tu seras notifié à chaque étape." | t: { moyen: providerLabel() } }}
                      } @else {
                        {{ 'Un administrateur valide ta demande, puis le montant est envoyé sur ton compte {moyen}. Tu seras notifié à chaque étape.' | t: { moyen: providerLabel() } }}
                      }
                    }
                  </p>
                  <button class="btn3d blue block" type="button" (click)="nav.navigateForward('/portefeuille/retraits')">{{ 'Suivre mes retraits' | t }}</button>
                </section>
              }
            }
          }
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
    }
    .text { font-weight: 700; line-height: 1.45; margin: 0 0 14px; }
    .amount-box input {
      font-family: var(--raf-font-display);
      font-size: 30px;
      font-weight: 400;
      text-align: right;
    }
    .quick {
      display: flex;
      gap: 10px;
      margin: -2px 0 16px;
      button { flex: 1; }
    }
    .sub-title { font-size: 18px; margin: 0 0 10px !important; }
    .providers {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .provider {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 12px 4px;
      border-radius: 16px;
      background: #fff;
      border: 3px solid var(--raf-p200);
      box-shadow: 0 3px 0 var(--raf-p300);
      color: var(--raf-ink);
      font-family: inherit;
      cursor: pointer;
      &.selected {
        border-color: var(--raf-primary);
        background: var(--raf-p50);
        box-shadow: 0 3px 0 var(--raf-edge), 0 0 0 3px rgba(255, 154, 26, 0.3);
      }
    }
    .p-name { font-family: var(--raf-font-display); font-size: 17px; }
    .p-sub { font-size: 11px; font-weight: 800; color: var(--raf-ink-soft); text-align: center; }
    .recap {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
      div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-radius: 14px;
        background: #fff;
        border: 2px solid var(--raf-p100);
        font-weight: 800;
      }
      strong { font-family: var(--raf-font-display); font-weight: 400; font-size: 18px; }
      .net { background: var(--raf-p100); border-color: var(--raf-p300); }
    }
    .otp-error { margin-top: 12px; }
    .confirm { margin-top: 16px; }
    .links {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
    }
    .done { text-align: center; }
    .done .recap { text-align: left; margin-top: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawPage {
  protected readonly auth = inject(AuthService);
  protected readonly state = inject(PlayerStateService);
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);

  protected readonly providers = PROVIDERS;
  protected readonly step = signal<Step>('form');
  protected readonly provider = signal<PaymentProvider>('MONCASH');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<Withdrawal | null>(null);

  protected amountHtg: number | null = null;
  protected destination = (this.auth.user()?.phone ?? '').replace(/^\+509/, '');
  protected otp = '';

  protected readonly providerLabel = computed(() => t(PROVIDERS.find((p) => p.value === this.provider())!.label));

  /** Codes de retrait par email (secours du back-office) ; faux tant qu'on ne sait pas. */
  protected readonly byEmail = signal(false);
  /** Canal du dernier code envoye, donne par le serveur. */
  protected readonly codeChannel = signal<CodeChannel>('SMS');

  /** Envoi automatique des retraits MonCash / NatCash ; null tant qu'on ne sait pas. */
  private readonly payout = signal<PayoutConfig | null>(null);
  protected readonly automatic = computed(() => !!this.payout()?.enabled && this.provider() !== 'MANUAL');
  protected readonly feePercent = computed(() => {
    const bps = this.payout()?.feeBps ?? 0;
    return `${(bps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
  });

  /** Meme calcul que le serveur : montant / (1 + frais), arrondi en dessous. */
  protected estimatedNet(): number | null {
    const amount = Math.round(Number(this.amountHtg) || 0);
    const config = this.payout();
    if (!this.automatic() || !config || amount <= 0) {
      return null;
    }
    return Math.floor((amount * 10_000) / (10_000 + config.feeBps));
  }

  ionViewWillEnter(): void {
    void this.state.refreshWallet();
    firstValueFrom(this.apiService.payoutConfig())
      .then((c) => this.payout.set(c))
      .catch(() => this.payout.set(null));
    firstValueFrom(this.apiService.withdrawalCodesConfig())
      .then((c) => this.byEmail.set(c.byEmail))
      .catch(() => this.byEmail.set(false));
  }

  protected destinationNormalized(): string {
    return normalizePhone(this.destination);
  }

  protected setPercent(percent: number): void {
    const wallet = this.state.wallet();
    if (!wallet) {
      return;
    }
    this.amountHtg = Math.floor((wallet.winningsBalanceHtg * percent) / 100);
  }

  protected async sendCode(): Promise<void> {
    const problem = this.check();
    if (problem) {
      this.error.set(problem);
      void this.feedback.buzz('error');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.apiService.sendWithdrawalOtp());
      this.codeChannel.set(response.channel ?? 'SMS');
      this.byEmail.set(response.channel === 'EMAIL');
      this.otp = '';
      this.step.set('otp');
      void this.feedback.toast(response.message, 'success');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirm(): Promise<void> {
    if (!/^\d{4,8}$/.test(this.otp.trim())) {
      this.error.set(t(this.codeChannel() === 'EMAIL' ? 'Saisis le code reçu par email.' : 'Saisis le code reçu par SMS.'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const withdrawal = await firstValueFrom(
        this.apiService.requestWithdrawal({
          amountHtg: Math.round(this.amountHtg ?? 0),
          provider: this.provider(),
          destinationNumber: this.provider() === 'MANUAL' ? null : this.destinationNormalized(),
          otpCode: this.otp.trim(),
        }),
      );
      this.done.set(withdrawal);
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
    const wallet = this.state.wallet();
    const amount = Number(this.amountHtg);
    if (!amount || amount <= 0) {
      return t('Indique le montant à retirer.');
    }
    if (!Number.isInteger(amount)) {
      return t('Le montant doit être un nombre entier de gourdes.');
    }
    if (wallet && amount > wallet.winningsBalanceHtg) {
      return t('Ce montant dépasse tes gains disponibles.');
    }
    if (this.provider() !== 'MANUAL' && !/^\+[1-9]\d{7,14}$/.test(this.destinationNormalized())) {
      return t('Indique un numéro {moyen} valide.', { moyen: this.providerLabel() });
    }
    return null;
  }
}
