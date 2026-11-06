import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';

import { FeedbackService } from '../../core/feedback.service';
import { PlayerStateService } from '../../core/player-state.service';
import { IconComponent } from '../../ui/icon.component';

/**
 * Barre d'onglets du bas, facon jeu mobile : l'onglet actif se souleve et s'illumine.
 * L'Accueil, au centre (actualite, quiz en groupe et solo dans ses propres
 * onglets), ressemble aux autres ; actif, sa tuile est plus grande et son halo respire.
 */
@Component({
  selector: 'raf-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IconComponent],
  template: `
    <ion-tabs (ionTabsDidChange)="feedback.tap()">
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="portefeuille">
          <span class="tile"><raf-icon name="chest" [size]="32" /></span>
          <span class="label">Trésor</span>
        </ion-tab-button>
        <ion-tab-button tab="tickets">
          <span class="tile"><raf-icon name="ticket" [size]="32" /></span>
          <span class="label">Tickets</span>
        </ion-tab-button>
        <ion-tab-button tab="accueil" class="raised">
          <span class="tile"><raf-icon name="home" [size]="32" /></span>
          <span class="label">Accueil</span>
        </ion-tab-button>
        <ion-tab-button tab="alertes">
          <span class="tile">
            <raf-icon name="bell" [size]="32" />
            @if (state.unread() > 0) {
              <span class="badge-count">{{ state.unread() > 99 ? '99+' : state.unread() }}</span>
            }
          </span>
          <span class="label">Alertes</span>
        </ion-tab-button>
        <ion-tab-button tab="profil">
          <span class="tile"><raf-icon name="user" [size]="32" /></span>
          <span class="label">Profil</span>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    // Bandeau creme, liseré dore en haut : un cadre de jeu plutot qu'une barre systeme.
    ion-tab-bar {
      --background: transparent;
      --border: 0;
      height: calc(78px + var(--raf-safe-bottom));
      padding: 0 4px var(--raf-safe-bottom);
      background: linear-gradient(180deg, #ffffff 0%, var(--raf-p50) 55%, var(--raf-p100) 100%);
      border-top: 4px solid var(--raf-p300);
      box-shadow:
        inset 0 3px 0 rgba(255, 255, 255, 0.9),
        0 -3px 0 var(--raf-edge),
        0 -10px 24px rgba(184, 106, 0, 0.18);
      overflow: visible;
      contain: none;
    }

    ion-tab-button {
      --color: var(--raf-ink-soft);
      --color-selected: var(--raf-ink);
      --background: transparent;
      --ripple-color: transparent;
      overflow: visible;
      max-width: 90px;
    }

    // Le bouton interne d'Ionic masque ce qui deborde : les tuiles surelevees doivent sortir de la barre.
    ion-tab-button::part(native) {
      overflow: visible;
    }

    .tile {
      position: relative;
      display: grid;
      place-items: center;
      width: 50px;
      height: 46px;
      border-radius: 16px;
      transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.5), background 0.18s ease;
    }

    // Reflet en haut de la tuile, comme sur les boutons du jeu.
    .tile::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 8px;
      right: 8px;
      height: 30%;
      border-radius: 12px 12px 20px 20px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0));
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }

    .label {
      margin-top: 2px;
      font-family: var(--raf-font-display);
      font-size: 12.5px;
      letter-spacing: 0.03em;
      color: var(--raf-ink-soft);
      white-space: nowrap;
      transition: color 0.18s ease, transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.5);
    }

    ion-tab-button:active .tile {
      transform: scale(0.9);
    }

    // --- Onglet actif : tuile orange soulevee, liseré blanc, halo.
    .tab-selected .tile {
      transform: translateY(-12px) scale(1.14);
      background: linear-gradient(180deg, #ffc078 0%, #ff9a1a 100%);
      border: 3px solid #ffffff;
      box-shadow:
        0 4px 0 var(--raf-edge-dark),
        0 8px 16px rgba(184, 106, 0, 0.3),
        0 0 22px rgba(255, 154, 26, 0.45),
        inset 0 -3px 0 rgba(184, 106, 0, 0.35);
      animation: tab-pop 0.36s cubic-bezier(0.2, 0.9, 0.3, 1.4);
    }

    .tab-selected .tile::after {
      opacity: 1;
    }

    // Libelle actif : lettres blanches cernees, comme les titres du jeu.
    .tab-selected .label {
      display: inline-block;
      color: #fff;
      transform: translateY(-7px);
      -webkit-text-stroke: 4px var(--raf-edge-dark);
      paint-order: stroke fill;
      text-shadow: 0 2px 0 var(--raf-edge-dark);
    }

    // --- L'Accueil, une fois actif : tuile plus grande, plus haute, halo qui respire.
    .raised.tab-selected .tile {
      width: 62px;
      height: 58px;
      margin-top: -32px;
      border-radius: 20px;
      transform: translateY(-4px) scale(1.08);
      box-shadow:
        0 5px 0 var(--raf-edge-dark),
        0 10px 18px rgba(184, 106, 0, 0.3),
        0 0 26px rgba(255, 154, 26, 0.5),
        inset 0 -3px 0 rgba(184, 106, 0, 0.35);
      animation: tab-pop-raised 0.36s cubic-bezier(0.2, 0.9, 0.3, 1.4), tab-glow 2.4s ease-in-out 0.4s infinite;
    }

    // La tuile agrandie prend deja la hauteur : le libelle reste a sa place.
    .raised.tab-selected .label {
      transform: translateY(6px);
    }

    .raised.tab-selected raf-icon {
      transform: scale(1.2);
    }

    .badge-count {
      top: -6px;
      right: -4px;
    }

    @keyframes tab-pop {
      0% { transform: translateY(0) scale(0.9); }
      60% { transform: translateY(-15px) scale(1.2); }
      100% { transform: translateY(-12px) scale(1.14); }
    }

    @keyframes tab-pop-raised {
      0% { transform: translateY(0) scale(0.92); }
      60% { transform: translateY(-7px) scale(1.14); }
      100% { transform: translateY(-4px) scale(1.08); }
    }

    // Accueil actif : halo qui respire doucement.
    @keyframes tab-glow {
      0%, 100% { box-shadow: 0 5px 0 var(--raf-edge-dark), 0 10px 18px rgba(184, 106, 0, 0.3), 0 0 18px rgba(255, 154, 26, 0.35), inset 0 -3px 0 rgba(184, 106, 0, 0.35); }
      50% { box-shadow: 0 5px 0 var(--raf-edge-dark), 0 10px 18px rgba(184, 106, 0, 0.3), 0 0 32px rgba(255, 154, 26, 0.65), inset 0 -3px 0 rgba(184, 106, 0, 0.35); }
    }

    @media (prefers-reduced-motion: reduce) {
      .tile,
      .label {
        transition: none;
        animation: none !important;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPage {
  protected readonly state = inject(PlayerStateService);
  protected readonly feedback = inject(FeedbackService);
}
