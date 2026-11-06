import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  InfiniteScrollCustomEvent,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FeedbackService } from '../../core/feedback.service';
import { LeaderTransfer, LeaderTransferConfig, LeaderTransferPlayer } from '../../core/models';
import { PlayerStateService } from '../../core/player-state.service';
import { uuid } from '../../core/uuid';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe, NumPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

type Step = 'pick' | 'amount' | 'confirm' | 'done';

/** Montants proposes en un clic, gardes s'ils tiennent dans les bornes et le solde. */
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
const SEARCH_DELAY_MS = 300;
const PAGE_SIZE = 20;

/**
 * Recharge d'un joueur par son leader, avec les credits du leader. Reserve aux leaders
 * (bouton du Tresor). Quatre etapes : choisir le joueur parmi les siens (recherche par
 * nom ou telephone, les derniers recharges en tete), saisir le montant, verifier le
 * recapitulatif, confirmer. La recharge est definitive.
 */
@Component({
  selector: 'raf-leader-transfer',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TopBarComponent,
    IconComponent,
    NumPipe,
    DateTimePipe,
  ],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille" title="Recharger un joueur" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="available glass">
          <raf-icon name="coin" [size]="46" />
          <div>
            <div class="label">Tes crédits</div>
            <div class="value">{{ balance() === null ? '…' : (balance() | num) }}</div>
          </div>
        </section>

        @if (loadError(); as message) {
          <div class="panel">
            <div class="alert-box">{{ message }}</div>
            <button class="btn3d blue block" type="button" (click)="init()">Réessayer</button>
          </div>
        } @else if (config(); as c) {
          @if (!c.enabled) {
            <div class="panel">
              <div class="alert-box info">La recharge des joueurs est momentanément désactivée. Réessaie plus tard.</div>
            </div>
          } @else {
            @switch (step()) {
              @case ('pick') {
                <section class="panel panel-with-ribbon">
                  <div class="ribbon">Quel joueur ?</div>
                  <label class="field search">
                    <span class="input-box">
                      <raf-icon name="user" [size]="24" />
                      <input
                        type="search"
                        name="search"
                        autocomplete="off"
                        placeholder="Nom ou numéro de téléphone"
                        [ngModel]="query()"
                        (ngModelChange)="search($event)"
                      />
                    </span>
                  </label>

                  @if (players() === null) {
                    <div class="skeleton row-skel"></div>
                    <div class="skeleton row-skel"></div>
                  } @else if (players()!.length === 0) {
                    <div class="empty-state small">
                      @if (query().trim()) {
                        <div class="empty-text">Aucun de tes joueurs ne correspond à « {{ query().trim() }} ».</div>
                      } @else {
                        <div class="empty-title">Aucun joueur rattaché</div>
                        <div class="empty-text">Invite des amis depuis ton profil : ils apparaîtront ici.</div>
                      }
                    </div>
                  } @else {
                    @for (p of players(); track p.id) {
                      <button class="list-row clickable player" type="button" (click)="pick(p)">
                        <span class="avatar">{{ initials(p) }}</span>
                        <span class="grow">
                          <span class="row-title">{{ p.firstName }} {{ p.lastName }}</span>
                          <span class="row-sub">
                            @if (p.phoneEnd) {
                              Tél. •••• {{ p.phoneEnd }}
                            }
                            @if (p.lastTransferAt) {
                              · dernière recharge {{ p.lastTransferCredits | num }} cr. {{ p.lastTransferAt | dateTime }}
                            }
                          </span>
                        </span>
                        <raf-icon name="chevron" [size]="20" />
                      </button>
                    }
                    <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="more($event)">
                      <ion-infinite-scroll-content />
                    </ion-infinite-scroll>
                  }
                </section>

                @if (history().length > 0) {
                  <h2 class="section-title">Tes dernières recharges</h2>
                  <div class="panel tight">
                    @for (t of history(); track t.id) {
                      <div class="tx">
                        <raf-icon name="users" [size]="30" />
                        <div class="grow">
                          <div class="row-title">{{ t.playerFirstName }} {{ t.playerLastName }}</div>
                          <div class="row-sub">{{ t.createdAt | dateTime }}</div>
                        </div>
                        <div class="tx-amount">{{ t.credits | num }} cr.</div>
                      </div>
                    }
                  </div>
                }
              }

              @case ('amount') {
                @if (selected(); as p) {
                  <section class="panel panel-with-ribbon">
                    <div class="ribbon">Montant</div>
                    <div class="chosen">
                      <span class="avatar">{{ initials(p) }}</span>
                      <span class="grow">
                        <span class="row-title">{{ p.firstName }} {{ p.lastName }}</span>
                        @if (p.phoneEnd) {
                          <span class="row-sub">Tél. •••• {{ p.phoneEnd }}</span>
                        }
                      </span>
                      <button class="link-btn ink" type="button" (click)="backToPick()">Changer</button>
                    </div>

                    <label class="field">
                      <span class="input-box amount-box">
                        <input type="number" inputmode="numeric" name="credits" [(ngModel)]="credits" step="1" min="0" placeholder="0" />
                        <span class="prefix">crédits</span>
                      </span>
                      <span class="field-hint">Entre {{ c.minCredits | num }} et {{ maxAllowed() | num }} crédits.</span>
                    </label>
                    @if (quickAmounts().length > 0) {
                      <div class="quick">
                        @for (a of quickAmounts(); track a) {
                          <button class="btn3d cream sm" type="button" (click)="credits = a">{{ a | num }}</button>
                        }
                      </div>
                    }

                    @if (error(); as message) {
                      <div class="alert-box">{{ message }}</div>
                    }
                    <button class="btn3d orange block" type="button" (click)="review()">Continuer</button>
                  </section>
                }
              }

              @case ('confirm') {
                @if (selected(); as p) {
                  <section class="panel panel-with-ribbon">
                    <div class="ribbon blue">Vérification</div>
                    <div class="recap">
                      <div><span>Joueur</span><strong>{{ p.firstName }} {{ p.lastName }}</strong></div>
                      @if (p.phoneEnd) {
                        <div><span>Téléphone</span><strong>•••• {{ p.phoneEnd }}</strong></div>
                      }
                      <div class="net"><span>Montant</span><strong>{{ credits | num }} cr.</strong></div>
                      <div><span>Ton solde après</span><strong>{{ (balance() ?? 0) - (credits ?? 0) | num }} cr.</strong></div>
                    </div>
                    <div class="alert-box info">Cette recharge est définitive : vérifie bien le joueur et le montant.</div>
                    @if (error(); as message) {
                      <div class="alert-box">{{ message }}</div>
                    }
                    <button class="btn3d block confirm" type="button" [disabled]="busy()" (click)="confirm()">
                      {{ busy() ? 'Envoi…' : 'Confirmer la recharge' }}
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
                    <div class="ribbon green">Recharge envoyée !</div>
                    <raf-icon class="pop-in" name="check" [size]="80" />
                    <div class="recap">
                      <div><span>Joueur</span><strong>{{ d.playerFirstName }} {{ d.playerLastName }}</strong></div>
                      <div class="net"><span>Montant</span><strong>{{ d.credits | num }} cr.</strong></div>
                      <div><span>Ton solde</span><strong>{{ d.leaderBalanceAfter | num }} cr.</strong></div>
                    </div>
                    <p class="text">{{ d.playerFirstName }} a reçu une notification : ses crédits sont déjà disponibles.</p>
                    <button class="btn3d orange block" type="button" (click)="again()">Recharger un autre joueur</button>
                    <button class="btn3d blue block back-btn" type="button" (click)="nav.navigateBack('/portefeuille')">Retour au Trésor</button>
                  </section>
                }
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
    }
    .search { margin-bottom: 12px; }
    .row-skel { height: 64px; margin-bottom: 10px; border-radius: 18px; }
    .player { width: 100%; text-align: left; font: inherit; }
    .player .row-title, .player .row-sub { display: block; }
    .avatar {
      flex: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--raf-p100);
      border: 2px solid var(--raf-p300);
      font-family: var(--raf-font-display);
      font-size: 16px;
      color: var(--raf-edge-dark);
    }
    .empty-state.small { padding: 16px 0 6px; }
    .chosen {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      margin-bottom: 14px;
      border-radius: 16px;
      background: var(--raf-p50);
      border: 2px solid var(--raf-p200);
      .row-title, .row-sub { display: block; }
      .row-title { font-weight: 900; }
      .row-sub { font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); }
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
    }
    .confirm { margin-top: 14px; }
    .links { display: flex; justify-content: center; margin-top: 10px; }
    .text { font-weight: 700; line-height: 1.45; margin: 0 0 14px; }
    .done { text-align: center; }
    .done .recap { text-align: left; margin-top: 12px; }
    .back-btn { margin-top: 10px; }
    .tx {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 4px;
      & + & { border-top: 2px dashed var(--raf-p100); }
      .grow { flex: 1; min-width: 0; }
      .row-title { font-weight: 900; }
      .row-sub { font-size: 13px; font-weight: 700; color: var(--raf-ink-soft); }
    }
    .tx-amount { font-family: var(--raf-font-display); font-size: 17px; white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderTransferPage implements OnDestroy {
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly state = inject(PlayerStateService);
  private readonly feedback = inject(FeedbackService);

  protected readonly step = signal<Step>('pick');
  protected readonly config = signal<LeaderTransferConfig | null>(null);
  protected readonly balance = signal<number | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly players = signal<LeaderTransferPlayer[] | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly history = signal<LeaderTransfer[]>([]);
  private page = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Ignore les reponses d'une recherche depassee par une frappe plus recente. */
  private searchId = 0;

  protected readonly selected = signal<LeaderTransferPlayer | null>(null);
  protected credits: number | null = null;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<LeaderTransfer | null>(null);
  /** Une cle par recharge : un nouvel essai apres une coupure reseau n'est pas applique deux fois. */
  private requestKey: string | null = null;

  protected readonly maxAllowed = computed(() => {
    const c = this.config();
    return c ? Math.min(c.maxCredits, this.balance() ?? 0) : 0;
  });

  protected readonly quickAmounts = computed(() => {
    const c = this.config();
    const max = this.maxAllowed();
    return c ? QUICK_AMOUNTS.filter((a) => a >= c.minCredits && a <= max).slice(0, 4) : [];
  });

  ionViewWillEnter(): void {
    void this.init();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  async init(): Promise<void> {
    this.loadError.set(null);
    try {
      const config = await firstValueFrom(this.apiService.leaderTransferConfig());
      this.config.set(config);
      this.balance.set(config.creditBalance);
      if (config.enabled) {
        await Promise.all([this.loadPlayers(), this.loadHistory()]);
      }
    } catch (e) {
      this.loadError.set(errorMessage(e));
    }
  }

  protected search(value: string): void {
    this.query.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => void this.loadPlayers(), SEARCH_DELAY_MS);
  }

  private async loadPlayers(): Promise<void> {
    const id = ++this.searchId;
    try {
      const page = await firstValueFrom(this.apiService.leaderTransferPlayers(this.query(), 0, PAGE_SIZE));
      if (id !== this.searchId) {
        return;
      }
      this.page = 0;
      this.players.set(page.content);
      this.hasMore.set(!page.last);
    } catch (e) {
      if (id === this.searchId) {
        this.players.set(this.players() ?? []);
        void this.feedback.error(e);
      }
    }
  }

  protected async more(event: InfiniteScrollCustomEvent): Promise<void> {
    const id = this.searchId;
    try {
      const page = await firstValueFrom(
        this.apiService.leaderTransferPlayers(this.query(), this.page + 1, PAGE_SIZE),
      );
      if (id === this.searchId) {
        this.page++;
        this.players.update((list) => [...(list ?? []), ...page.content]);
        this.hasMore.set(!page.last);
      }
    } catch (e) {
      void this.feedback.error(e);
    } finally {
      await event.target.complete();
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      this.history.set((await firstValueFrom(this.apiService.leaderTransfers(0, 5))).content);
    } catch {
      // L'historique est un complement : son absence ne bloque pas la recharge.
    }
  }

  protected pick(player: LeaderTransferPlayer): void {
    this.feedback.tap();
    this.selected.set(player);
    this.error.set(null);
    this.step.set('amount');
  }

  protected backToPick(): void {
    this.selected.set(null);
    this.credits = null;
    this.error.set(null);
    this.step.set('pick');
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
    this.step.set('amount');
  }

  protected async confirm(): Promise<void> {
    const player = this.selected();
    if (!player || this.credits == null || this.busy()) {
      return;
    }
    this.requestKey ??= uuid();
    this.busy.set(true);
    this.error.set(null);
    try {
      const transfer = await firstValueFrom(
        this.apiService.leaderTransfer(player.id, this.credits, this.requestKey),
      );
      this.done.set(transfer);
      this.balance.set(transfer.leaderBalanceAfter);
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

  protected again(): void {
    this.done.set(null);
    this.backToPick();
    this.query.set('');
    void this.loadPlayers();
    void this.loadHistory();
  }

  protected initials(p: LeaderTransferPlayer): string {
    return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  }

  private check(): string | null {
    const c = this.config();
    const amount = this.credits;
    if (!c) {
      return 'Chargement en cours, réessaie dans un instant.';
    }
    if (amount == null || !Number.isInteger(amount) || amount <= 0) {
      return 'Saisis un nombre entier de crédits.';
    }
    if (amount < c.minCredits) {
      return `Le minimum est de ${c.minCredits} crédits.`;
    }
    if (amount > c.maxCredits) {
      return `Le maximum est de ${c.maxCredits} crédits par recharge.`;
    }
    if (amount > (this.balance() ?? 0)) {
      return "Tu n'as pas assez de crédits. Recharge d'abord ton solde.";
    }
    return null;
  }
}
