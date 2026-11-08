import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FeedbackService } from '../../core/feedback.service';
import { DepositNumbers, OnlineTopUpConfig, TopUp, TopUpAvailability } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe, NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

/*
 * Recharge. En ligne : le joueur paie par MonCash ou NatCash via la passerelle
 * Tranzak (page recharger-en-ligne), frais a sa charge ; l'option n'apparait que
 * si le serveur la dit disponible. Sinon, un agent RAF credite le compte depuis
 * le back-office (recharge manuelle). La page montre aussi l'historique.
 *
 * A distance : le joueur envoie l'argent par MonCash ou NatCash, depuis le numero
 * de son compte, au numero de l'agent (regle dans le back-office) ; l'agent
 * reconnait l'expediteur et credite le montant recu. L'indicateur « agent en
 * ligne » (comme sur WhatsApp) dit si ce sera fait tout de suite : l'agent
 * l'allume depuis le back-office quand il est la pour crediter.
 *
 * Avec les gains : le joueur paie des credits avec son solde de gains (HTG). Le
 * bouton n'apparait que si ses gains valent au moins un credit et que
 * l'administrateur n'a pas coupe la fonctionnalite.
 */

/** Frequence de mise a jour de l'indicateur tant que la page est affichee. */
const AVAILABILITY_POLL_MS = 30_000;

interface DepositNumber {
  label: string;
  css: string;
  /** Tel que l'agent le recoit : +50937123456. */
  value: string;
  /** +509 3712 3456 */
  display: string;
}

function depositNumber(label: string, value: string | null | undefined): DepositNumber[] {
  if (!value) {
    return [];
  }
  const match = value.match(/^\+509(\d{4})(\d{4})$/);
  const display = match ? `+509 ${match[1]} ${match[2]}` : value;
  return [{ label, css: label.toLowerCase(), value, display }];
}

@Component({
  selector: 'raf-top-up',
  imports: [IonHeader, IonToolbar, IonContent, TopBarComponent, IconComponent, NumPipe, DateTimePipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille" title="Recharger" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (online()?.enabled) {
          <section class="panel panel-with-ribbon">
            <div class="ribbon green">En ligne</div>
            <p class="lead">Paie directement par MonCash ou NatCash : tes crédits arrivent tout de suite, sans agent.</p>
            <div class="brands">
              <div class="brand moncash">MonCash</div>
              <div class="brand natcash">NatCash</div>
            </div>
            <button class="btn3d orange block" type="button" (click)="nav.navigateForward('/portefeuille/recharger-en-ligne')">
              Payer en ligne
            </button>
            <p class="fee-note">Frais de paiement de {{ feePercent() }} en plus du montant.</p>
          </section>
        }

        @if (canConvert()) {
          @let w = state.wallet()!;
          <section class="panel panel-with-ribbon">
            <div class="ribbon green">Avec mes gains</div>
            <p class="lead">Tu as {{ w.winningsBalanceHtg | num }} HTG de gains : transforme-les en crédits, tout de suite.</p>
            <button class="btn3d green block" type="button" (click)="nav.navigateForward('/portefeuille/recharger-avec-gains')">
              <raf-icon name="coin" [size]="26" /> Recharger avec mes gains
            </button>
          </section>
        }

        @if (hasNumbers()) {
          <section class="panel panel-with-ribbon">
            <div class="ribbon">À distance</div>
            @if (availability(); as a) {
              <div class="presence" [class.on]="a.available" role="status">
                <span class="dot"></span>
                <div class="grow">
                  @if (a.available) {
                    <div class="opt-title">Agent en ligne</div>
                    <div class="opt-sub">Ta recharge est créditée tout de suite.</div>
                  } @else {
                    <div class="opt-title">
                      Aucun agent en ligne
                      @if (a.lastSeenAt) {
                        <span class="seen">· vu {{ a.lastSeenAt | dateTime }}</span>
                      }
                    </div>
                    <div class="opt-sub">Ta recharge sera créditée dès le retour d'un agent.</div>
                  }
                </div>
              </div>
            }

            <p class="lead">Envoie l'argent par MonCash ou NatCash, sans te déplacer.</p>
            @for (n of numbers(); track n.label) {
              <div class="option">
                <div class="brand" [class]="n.css">{{ n.label }}</div>
                <div class="grow">
                  <div class="opt-sub">Numéro de l'agent RAF</div>
                  <div class="number">{{ n.display }}</div>
                </div>
                <button type="button" class="copy" (click)="copy(n)">Copier</button>
              </div>
            }
            <ol class="steps">
              @if (auth.user(); as u) {
                <li>Envoie le montant <strong>depuis le numéro de ton compte RAF ({{ u.phone }})</strong>.</li>
              } @else {
                <li>Envoie le montant <strong>depuis le numéro de ton compte RAF</strong>.</li>
              }
              <li>L'agent reconnaît ton numéro et crédite ton compte du montant reçu.</li>
              <li>Tu reçois une notification dès que tes crédits arrivent.</li>
            </ol>
            <p class="warn">
              Depuis un autre numéro, l'agent ne peut pas savoir à qui appartient l'argent :
              ta recharge serait retardée.
            </p>
          </section>
        }

        <section class="panel panel-with-ribbon">
          <div class="ribbon blue">Au guichet RAF</div>
          <p class="lead">Un agent RAF crédite ton compte sur place, en espèces.</p>
          <ol class="steps">
            <li>Rends-toi chez un agent RAF.</li>
            <li>Donne-lui ton numéro de téléphone ou ton identifiant joueur.</li>
            <li>Paie en HTG : tes crédits arrivent aussitôt, avec une notification.</li>
          </ol>
          @if (auth.user(); as u) {
            <div class="id-card">
              <div><span>Identifiant joueur</span><strong>#{{ u.id }}</strong></div>
              <div><span>Téléphone</span><strong>{{ u.phone }}</strong></div>
            </div>
          }
        </section>

        @if (online() && !online()!.enabled) {
          <section class="option soon first-soon">
            <div class="brand moncash">MonCash</div>
            <div class="grow">
              <div class="opt-title">Paiement automatique</div>
              <div class="opt-sub">Directement depuis l'app, sans agent</div>
            </div>
            <span class="soon-tag">Bientôt</span>
          </section>
          <section class="option soon">
            <div class="brand natcash">NatCash</div>
            <div class="grow">
              <div class="opt-title">Paiement automatique</div>
              <div class="opt-sub">Directement depuis l'app, sans agent</div>
            </div>
            <span class="soon-tag">Bientôt</span>
          </section>
        }

        @if (topUps().length > 0) {
          <h2 class="section-title">Mes recharges</h2>
          <div class="panel tight">
            @for (t of topUps(); track t.id) {
              <div class="row">
                <raf-icon name="coin" [size]="30" />
                <div class="grow">
                  <div class="opt-title">+{{ t.credits | num }} crédits</div>
                  <div class="opt-sub">{{ t.chargedHtg ?? t.amountHtg | num }} HTG · {{ provider(t) }} · {{ t.createdAt | dateTime }}</div>
                  @if (t.retentionUsedHtg > 0 || t.retentionKeptHtg > 0) {
                    <div class="opt-sub">
                      @if (t.retentionUsedHtg > 0) {
                        + {{ t.retentionUsedHtg | num }} HTG repris de ta retenue
                      }
                      @if (t.retentionUsedHtg > 0 && t.retentionKeptHtg > 0) {
                        ·
                      }
                      @if (t.retentionKeptHtg > 0) {
                        {{ t.retentionKeptHtg | num }} HTG gardés pour la prochaine
                      }
                    </div>
                  }
                </div>
                @if (t.status === 'PENDING' && t.paymentUrl) {
                  <a class="resume" [href]="t.paymentUrl">Payer</a>
                } @else {
                  <span class="state" [class.ok]="t.status === 'CONFIRMED'">{{ status(t) }}</span>
                }
              </div>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .presence {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      border-radius: 20px;
      background: #fff;
      border: 3px solid var(--raf-p100);
      color: var(--raf-ink);
      .dot {
        width: 14px;
        height: 14px;
        flex: none;
        border-radius: 50%;
        background: #a3a3b5;
      }
      .seen { font-weight: 700; font-size: 12.5px; color: var(--raf-ink-soft); }
      &.on {
        border-color: #9fdc8a;
        .dot {
          background: #2fb344;
          animation: pulse 2s ease-out infinite;
        }
      }
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(47, 179, 68, 0.55); }
      70% { box-shadow: 0 0 0 10px rgba(47, 179, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(47, 179, 68, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .presence.on .dot { animation: none; }
    }
    .option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      border-radius: 20px;
      background: #fff;
      border: 3px solid var(--raf-p100);
      box-shadow: 0 4px 0 var(--raf-p200);
      color: var(--raf-ink);
      &.soon { opacity: 0.8; }
      &.first-soon { margin-top: 20px; }
    }
    .brand {
      width: 64px;
      height: 46px;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 12px;
      color: #fff;
      font-weight: 900;
      font-size: 12px;
      &.moncash { background: linear-gradient(180deg, #ff6a5c, #d4202c); }
      &.natcash { background: linear-gradient(180deg, #ffb340, #f06a00); }
    }
    .grow { flex: 1; min-width: 0; }
    .opt-title { font-weight: 900; font-size: 15.5px; }
    .opt-sub { font-weight: 700; font-size: 12.5px; color: var(--raf-ink-soft); }
    .soon-tag {
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--raf-p100);
      color: var(--raf-ink-soft);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
    }
    .lead { font-weight: 800; margin: 0 0 10px; }
    .brands { display: flex; gap: 10px; margin-bottom: 12px; }
    .fee-note { margin: 10px 0 0; font-size: 12.5px; font-weight: 700; color: var(--raf-ink-soft); text-align: center; }
    .resume {
      padding: 6px 12px;
      border-radius: 12px;
      background: var(--raf-p100);
      color: var(--raf-ink);
      font-weight: 900;
      font-size: 13px;
      text-decoration: none;
    }
    .number {
      font-family: var(--raf-font-display);
      font-size: 20px;
      user-select: all;
    }
    .copy {
      flex: none;
      padding: 8px 12px;
      border-radius: 12px;
      border: 2px solid var(--raf-p200);
      background: var(--raf-p100);
      color: var(--raf-ink);
      font-weight: 900;
      font-size: 13px;
    }
    .warn {
      margin: 0;
      padding: 10px 12px;
      border-radius: 14px;
      background: #fff4e0;
      color: #8a4b00;
      font-weight: 700;
      font-size: 13px;
    }
    .steps {
      margin: 0 0 14px;
      padding-left: 20px;
      font-weight: 700;
      line-height: 1.6;
    }
    .id-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      div {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        border-radius: 14px;
        background: #fff;
        border: 2px dashed var(--raf-frame);
      }
      span { font-size: 12px; font-weight: 800; color: var(--raf-ink-soft); }
      strong { font-family: var(--raf-font-display); font-weight: 400; font-size: 20px; }
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 4px;
      & + & { border-top: 2px dashed var(--raf-p100); }
    }
    .state {
      font-weight: 900;
      font-size: 12px;
      color: var(--raf-ink-soft);
      &.ok { color: #1d630b; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopUpPage implements OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly state = inject(PlayerStateService);
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);

  protected readonly topUps = signal<TopUp[]>([]);
  private readonly depositNumbers = signal<DepositNumbers | null>(null);
  protected readonly numbers = computed(() => {
    const n = this.depositNumbers();
    return n ? [...depositNumber('MonCash', n.moncashNumber), ...depositNumber('NatCash', n.natcashNumber)] : [];
  });
  protected readonly hasNumbers = computed(() => this.numbers().length > 0);
  /** Recharge avec les gains autorisee par l'administrateur ; false tant qu'on ne sait pas. */
  private readonly conversionEnabled = signal(false);
  /** Le bouton ne s'affiche que si les gains valent au moins un credit. */
  protected readonly canConvert = computed(() => {
    const w = this.state.wallet();
    return this.conversionEnabled() && !!w && w.htgRate > 0 && w.winningsBalanceHtg >= w.htgRate;
  });
  /** Recharge en ligne (Tranzak) ; null tant qu'on ne sait pas. */
  protected readonly online = signal<OnlineTopUpConfig | null>(null);
  protected readonly feePercent = computed(() => {
    const bps = this.online()?.feeBps ?? 0;
    return `${(bps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
  });
  /** Null tant qu'on ne sait pas : mieux vaut ne rien montrer qu'un etat faux. */
  protected readonly availability = signal<TopUpAvailability | null>(null);

  private poll: ReturnType<typeof setInterval> | null = null;

  ionViewWillEnter(): void {
    firstValueFrom(this.apiService.topUps(0, 20))
      .then((page) => this.topUps.set(page.content))
      .catch(() => undefined);
    void this.state.refreshWallet();
    firstValueFrom(this.apiService.appConfig())
      .then((c) => this.conversionEnabled.set(c.winningsConversionEnabled === true))
      .catch(() => this.conversionEnabled.set(false));
    firstValueFrom(this.apiService.onlineTopUpConfig())
      .then((c) => this.online.set(c))
      .catch(() => this.online.set(null));
    firstValueFrom(this.apiService.depositNumbers())
      .then((n) => this.depositNumbers.set(n))
      .catch(() => undefined);
    this.refreshAvailability();
    this.stopPolling();
    this.poll = setInterval(() => this.refreshAvailability(), AVAILABILITY_POLL_MS);
  }

  ionViewWillLeave(): void {
    this.stopPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected copy(n: DepositNumber): void {
    navigator.clipboard
      .writeText(n.value)
      .then(() => this.feedback.success(`Numéro ${n.label} copié`))
      .catch(() => this.feedback.toast(`Numéro ${n.label} : ${n.display}`));
  }

  private refreshAvailability(): void {
    firstValueFrom(this.apiService.topUpAvailability())
      .then((a) => this.availability.set(a))
      .catch(() => this.availability.set(null));
  }

  private stopPolling(): void {
    if (this.poll !== null) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  protected provider(t: TopUp): string {
    switch (t.provider) {
      case 'MANUAL':
        return 'Agent RAF';
      case 'MONCASH':
        return 'MonCash';
      case 'NATCASH':
        return 'NatCash';
      case 'WINNINGS':
        return 'Avec mes gains';
    }
  }

  protected status(t: TopUp): string {
    switch (t.status) {
      case 'CONFIRMED':
        return 'Reçue';
      case 'PENDING':
        return 'En attente';
      case 'EXPIRED':
        return 'Expirée';
      default:
        return 'Échouée';
    }
  }
}
