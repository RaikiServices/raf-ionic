import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { Transaction, TransactionType } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe, NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

const TYPES: Record<TransactionType, { label: string; icon: string }> = {
  TOPUP: { label: 'Recharge', icon: 'coin' },
  TICKET_PURCHASE: { label: 'Ticket acheté', icon: 'ticket' },
  SOLO_ENTRY: { label: 'Partie solo', icon: 'flame' },
  PRIZE: { label: 'Gain remporté', icon: 'trophy' },
  COMMISSION: { label: 'Commission leader', icon: 'users' },
  INVITE_BONUS: { label: 'Bonus de bienvenue', icon: 'gift' },
  LEADER_TRANSFER_OUT: { label: "Recharge d'un joueur", icon: 'users' },
  LEADER_TRANSFER_IN: { label: 'Recharge par ton leader', icon: 'coin' },
  WITHDRAWAL: { label: 'Retrait', icon: 'bank' },
  REFUND: { label: 'Remboursement', icon: 'gift' },
  ADJUSTMENT: { label: 'Ajustement', icon: 'settings' },
};

/** Tresor : les deux soldes et l'historique des mouvements. */
@Component({
  selector: 'raf-wallet',
  imports: [
    IonHeader,
    IonIcon,
    IonToolbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TopBarComponent,
    IconComponent,
    NumPipe,
    DateTimePipe,
  ],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar title="Trésor" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-pad">
        @let w = state.wallet();

        <section class="vault credits pop-in">
          <div class="vault-head">
            <raf-icon name="coin" [size]="58" />
            <div>
              <div class="vault-label">Crédits de jeu</div>
              <div class="vault-value">{{ w ? (w.creditBalance | num) : '…' }}</div>
              <div class="vault-sub">1 crédit = {{ state.creditHtgRate() ?? '…' }} HTG · pour acheter des tickets</div>
            </div>
          </div>
          <button class="btn3d block" type="button" (click)="go('/portefeuille/recharger')">
            <raf-icon name="plus" [size]="22" /> Recharger
          </button>
        </section>

        <section class="vault winnings pop-in">
          <div class="vault-head">
            <raf-icon name="cash" [size]="58" />
            <div>
              <div class="vault-label">Gains</div>
              <div class="vault-value">{{ w ? (w.winningsBalanceHtg | num) : '…' }} <small>HTG</small></div>
              <div class="vault-sub">Retirables vers MonCash, NatCash ou en espèces</div>
            </div>
          </div>
          <button class="btn3d orange block" type="button" [disabled]="!w || w.winningsBalanceHtg <= 0" (click)="go('/portefeuille/retirer')">
            <raf-icon name="bank" [size]="28" /> Retirer
          </button>
        </section>

        <!-- Reserve aux leaders : ils rechargent leurs joueurs avec leurs propres credits. -->
        @if (canTransfer()) {
          <button class="btn3d purple block transfer" type="button" (click)="go('/portefeuille/recharger-joueur')">
            <raf-icon name="users" [size]="26" /> Recharger un joueur
          </button>
        }

        <button class="list-row clickable link-row" type="button" (click)="go('/portefeuille/retraits')">
          <raf-icon name="bank" [size]="32" />
          <span class="grow row-title">Mes demandes de retrait</span>
          <ion-icon name="chevron-forward" />
        </button>

        <h2 class="section-title">Historique</h2>
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (transactions() === null) {
          <div class="skeleton" style="height: 200px"></div>
        } @else if (transactions()!.length === 0) {
          <div class="empty-state">
            <div class="empty-text">Aucun mouvement pour l'instant.</div>
          </div>
        } @else {
          <div class="panel tight history">
            @for (t of transactions(); track t.id) {
              <div class="tx">
                <raf-icon [name]="icon(t)" [size]="34" />
                <div class="grow">
                  <div class="row-title">{{ label(t) }}</div>
                  <div class="row-sub">{{ t.createdAt | dateTime }}{{ t.description ? ' · ' + t.description : '' }}</div>
                </div>
                <div class="amount" [class.plus]="t.amount > 0" [class.minus]="t.amount < 0">
                  {{ t.amount > 0 ? '+' : '' }}{{ display(t) }}
                </div>
              </div>
            }
          </div>
          <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="more($event)">
            <ion-infinite-scroll-content />
          </ion-infinite-scroll>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .vault {
      position: relative;
      padding: 16px;
      margin-bottom: 18px;
      border-radius: 26px;
      border: 4px solid rgba(255, 255, 255, 0.6);
      box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.35), 0 7px 0 var(--raf-edge-dark), 0 14px 22px rgba(184, 106, 0, 0.25);
      overflow: hidden;
      &::after {
        content: '';
        position: absolute;
        top: -40%;
        right: -20%;
        width: 60%;
        height: 140%;
        background: rgba(255, 255, 255, 0.12);
        transform: rotate(20deg);
        pointer-events: none;
      }
    }
    .credits { background: linear-gradient(160deg, #ffc078 0%, #ff9a1a 100%); }
    .winnings { background: linear-gradient(160deg, #ffad47 0%, #e08816 100%); }
    .vault-head {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
    }
    .vault-label {
      font-weight: 900;
      text-transform: uppercase;
      font-size: 13px;
      letter-spacing: 0.04em;
    }
    .vault-value {
      font-family: var(--raf-font-display);
      font-size: 40px;
      line-height: 1;
      -webkit-text-stroke: 6px rgba(122, 61, 0, 0.35);
      paint-order: stroke fill;
      small { font-size: 22px; }
    }
    .vault-sub {
      font-weight: 800;
      font-size: 13px;
      opacity: 0.95;
      margin-top: 4px;
    }
    .transfer { margin: -4px 0 18px; }
    .link-row {
      width: 100%;
      text-align: left;
      font-family: inherit;
      ion-icon { color: var(--raf-ink-soft); font-size: 20px; }
    }
    .history { padding: 4px 12px; }
    .tx {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 2px;
      & + & { border-top: 2px dashed var(--raf-p100); }
    }
    .grow { flex: 1; min-width: 0; }
    .row-title { font-weight: 900; font-size: 15px; }
    .row-sub {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--raf-ink-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .amount {
      font-family: var(--raf-font-display);
      font-size: 18px;
      white-space: nowrap;
      &.plus { color: #1d8a0b; }
      &.minus { color: var(--raf-red-dark); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletPage {
  protected readonly state = inject(PlayerStateService);
  private readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);

  protected readonly transactions = signal<Transaction[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  private page = 0;

  private readonly isLeader = computed(() => this.auth.user()?.roles.includes('LEADER') ?? false);
  /** Coupee depuis le back-office : le bouton disparait. */
  private readonly transferEnabled = signal(true);
  protected readonly canTransfer = computed(() => this.isLeader() && this.transferEnabled());

  ionViewWillEnter(): void {
    void this.state.refreshWallet();
    void this.load();
    if (this.isLeader()) {
      void this.loadTransferFlag();
    }
  }

  private async loadTransferFlag(): Promise<void> {
    try {
      this.transferEnabled.set((await firstValueFrom(this.apiService.appConfig())).leaderTransferEnabled !== false);
    } catch {
      // Sans reponse, le bouton reste : l'ecran de recharge dira si la fonction est coupee.
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await Promise.all([this.state.refreshWallet(), this.load()]);
    await event.target.complete();
  }

  private async load(): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.transactions(0, 20));
      this.page = 0;
      this.transactions.set(page.content);
      this.hasMore.set(!page.last);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async more(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.transactions(this.page + 1, 20));
      this.page++;
      this.transactions.update((list) => [...(list ?? []), ...page.content]);
      this.hasMore.set(!page.last);
    } catch (e) {
      void this.feedback.error(e);
    } finally {
      await event.target.complete();
    }
  }

  protected go(url: string): void {
    this.feedback.tap();
    void this.nav.navigateForward(url);
  }

  protected label(t: Transaction): string {
    return TYPES[t.type]?.label ?? t.type;
  }

  protected icon(t: Transaction): string {
    return TYPES[t.type]?.icon ?? 'coin';
  }

  /** Les gains sont tenus en HTG, les credits en credits. */
  protected display(t: Transaction): string {
    const n = new NumPipe();
    return t.balanceType === 'WINNINGS' ? `${n.transform(t.amount)} HTG` : `${n.transform(t.amount)} cr.`;
  }
}
