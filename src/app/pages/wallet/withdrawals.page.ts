import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { Withdrawal, WithdrawalStatus } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { DateTimePipe, HtgPipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

const STATUS: Record<WithdrawalStatus, { label: string; cls: string }> = {
  AWAITING_OTP: { label: 'Code attendu', cls: 'scheduled' },
  PENDING: { label: 'En attente', cls: 'computing' },
  APPROVED: { label: 'Approuvé', cls: 'registration' },
  SENDING: { label: 'Envoi en cours', cls: 'registration' },
  PAID: { label: 'Versé', cls: 'running' },
  REJECTED: { label: 'Refusé', cls: 'closing' },
  CANCELLED: { label: 'Annulé', cls: 'cancelled' },
};

/** Suivi des demandes de retrait (lien des notifications : /portefeuille/retraits). */
@Component({
  selector: 'raf-withdrawals',
  imports: [IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, TopBarComponent, IconComponent, HtgPipe, DateTimePipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/portefeuille" title="Mes retraits" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>
      <div class="page-pad">
        @if (error(); as message) {
          <div class="panel"><div class="alert-box">{{ message }}</div></div>
        } @else if (items() === null) {
          <div class="skeleton" style="height: 140px"></div>
        } @else if (items()!.length === 0) {
          <div class="empty-state">
            <raf-icon class="float" name="bank" [size]="88" />
            <div class="empty-title">Aucun retrait</div>
            <div class="empty-text">Gagne un quiz, puis retire tes gains vers MonCash, NatCash ou en espèces.</div>
            <button class="btn3d orange" type="button" (click)="nav.navigateForward('/portefeuille/retirer')">Retirer mes gains</button>
          </div>
        } @else {
          <div class="list stagger">
            @for (w of items(); track w.id) {
              <section class="panel tight item">
                <div class="head">
                  <span [class]="'status-tag ' + status(w).cls">{{ status(w).label }}</span>
                  <span class="date">{{ w.createdAt | dateTime }}</span>
                </div>
                <div class="amounts">
                  <div class="net">{{ w.netHtg | htg }}</div>
                  <div class="detail">{{ w.amountHtg | htg }} − {{ w.feeHtg | htg }} de frais</div>
                </div>
                <div class="dest">
                  <raf-icon [name]="w.provider === 'MANUAL' ? 'bank' : 'phone'" [size]="24" />
                  {{ provider(w) }}{{ w.destinationNumber ? ' · ' + w.destinationNumber : '' }}
                </div>
                @if (w.status === 'APPROVED' && w.provider === 'MANUAL') {
                  <div class="alert-box info hint">Présente-toi au guichet RAF : l'agent t'enverra un code de remise par SMS.</div>
                }
                @if (w.status === 'REJECTED' && w.rejectionReason) {
                  <div class="alert-box hint">Motif : {{ w.rejectionReason }}. Le montant est revenu dans tes gains.</div>
                }
                @if (w.status === 'PAID' && w.paidAt) {
                  <div class="paid">Versé {{ w.paidAt | dateTime }}{{ w.payoutReference ? ' · réf. ' + w.payoutReference : '' }}</div>
                }
              </section>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .list { display: grid; gap: 14px; }
    .head { display: flex; justify-content: space-between; align-items: center; }
    .status-tag { font-size: 12px; }
    .date { font-weight: 800; font-size: 12.5px; color: var(--raf-ink-soft); }
    .amounts { margin: 10px 0 6px; }
    .net { font-family: var(--raf-font-display); font-size: 28px; line-height: 1; }
    .detail { font-weight: 700; font-size: 13px; color: var(--raf-ink-soft); margin-top: 2px; }
    .dest { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; }
    .hint { margin: 10px 0 0; }
    .paid { margin-top: 8px; font-weight: 800; font-size: 13px; color: #1d630b; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalsPage {
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);

  protected readonly items = signal<Withdrawal[] | null>(null);
  protected readonly error = signal<string | null>(null);

  ionViewWillEnter(): void {
    void this.load();
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }

  private async load(): Promise<void> {
    try {
      const page = await firstValueFrom(this.apiService.withdrawals(0, 50));
      this.items.set(page.content);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected status(w: Withdrawal): { label: string; cls: string } {
    return STATUS[w.status];
  }

  protected provider(w: Withdrawal): string {
    return w.provider === 'MANUAL' ? 'Espèces au guichet' : w.provider === 'MONCASH' ? 'MonCash' : 'NatCash';
  }
}
