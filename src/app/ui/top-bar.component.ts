import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonRouterOutlet, NavController } from '@ionic/angular/standalone';

import { AuthService } from '../core/auth.service';
import { formatNumber, initials } from '../core/format';
import { PlayerStateService } from '../core/player-state.service';
import { IconComponent } from './icon.component';
import { TPipe } from '../core/i18n';

/**
 * Barre du haut : logo RAF a gauche, puis retour ou avatar, titre, et les deux monnaies a droite
 * (credits de jeu et gains retirables), comme les compteurs d'un jeu mobile.
 */
@Component({
  selector: 'raf-top-bar',
  imports: [TPipe, IconComponent],
  template: `
    <div class="topbar">
      <button class="logo" type="button" [attr.aria-label]="'Accueil' | t" (click)="router.navigateByUrl('/accueil')">
        <img src="assets/logo-raf.png" alt="RAF" />
      </button>

      @if (back()) {
        <button class="btn3d sm icon-only back" type="button" [attr.aria-label]="'Retour' | t" (click)="goBack()">
          <raf-icon name="back" [size]="20" />
        </button>
      } @else {
        <button class="avatar" type="button" [attr.aria-label]="'Mon profil' | t" (click)="router.navigateByUrl('/profil')">
          {{ initialsText() }}
        </button>
      }

      @if (title(); as text) {
        <div class="title title-stroke sm">{{ text | t }}</div>
      } @else {
        <div class="spacer"></div>
      }

      @if (showWallet()) {
        <div class="wallet">
          <button class="pill" type="button" (click)="router.navigateByUrl('/portefeuille')" [attr.aria-label]="'Crédits de jeu' | t">
            <raf-icon class="pill-icon" name="coin" [size]="34" />
            {{ state.wallet()?.creditBalance ?? '…' }}
            <span class="pill-plus">+</span>
          </button>
          <button class="pill" type="button" (click)="router.navigateByUrl('/portefeuille')" [attr.aria-label]="'Gains en HTG' | t">
            <raf-icon class="pill-icon" name="cash" [size]="34" />
            {{ winningsHtg() }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    // Pas « .bar » : la classe globale du meme nom dessine les barres de progression.
    .topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
    }
    .title {
      flex: 1;
      min-width: 0;
      font-size: 22px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .spacer { flex: 1; }
    .wallet {
      display: flex;
      gap: 4px;
      flex: none;
    }
    .pill { font-size: 16px; padding-left: 24px; }
    .avatar {
      width: 44px;
      height: 44px;
      flex: none;
      border-radius: 14px;
      border: 3px solid #fff;
      background: linear-gradient(180deg, #ffc078, #ff9a1a);
      box-shadow: 0 3px 0 var(--raf-edge-dark), inset 0 3px 0 rgba(255, 255, 255, 0.45);
      color: #fff;
      font-family: var(--raf-font-display);
      font-size: 18px;
      -webkit-text-stroke: 3px rgba(120, 50, 0, 0.6);
      paint-order: stroke fill;
      cursor: pointer;
    }
    .back { flex: none; }
    .logo {
      flex: none;
      padding: 0;
      border: 0;
      background: none;
      line-height: 0;
      cursor: pointer;
      img {
        height: 34px;
        width: auto;
        filter: drop-shadow(0 2px 0 rgba(184, 106, 0, 0.35));
      }
    }
    // Petits telephones : le logo retrecit pour laisser la place au titre et aux compteurs.
    @media (max-width: 380px) {
      .logo img { height: 26px; }
      .title { font-size: 19px; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
  protected readonly router = inject(Router);
  protected readonly state = inject(PlayerStateService);
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly outlet = inject(IonRouterOutlet, { optional: true });

  /** true : retour a l'ecran precedent ; une URL : retour a cette page par defaut. */
  readonly back = input<boolean | string>(false);
  readonly title = input<string | null>(null);
  readonly showWallet = input(true);

  protected initialsText(): string {
    const user = this.auth.user();
    return initials(user?.firstName, user?.lastName);
  }

  protected winningsHtg(): string {
    const wallet = this.state.wallet();
    if (!wallet) {
      return '…';
    }
    return formatNumber(wallet.winningsBalanceHtg);
  }

  protected goBack(): void {
    const fallback = typeof this.back() === 'string' ? (this.back() as string) : '/accueil';
    // Pas d'ecran precedent (lien profond, notification) : on remonte vers la page parente.
    if (this.outlet?.canGoBack()) {
      this.nav.back();
    } else {
      void this.nav.navigateBack(fallback);
    }
  }
}
