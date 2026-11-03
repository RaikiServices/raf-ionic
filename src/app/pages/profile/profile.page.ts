import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonModal, IonToggle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FeedbackService } from '../../core/feedback.service';
import { initials } from '../../core/format';
import { SoundService } from '../../core/sound.service';
import { IconComponent } from '../../ui/icon.component';
import { closeModal } from '../../ui/modal';
import { DatePipe } from '../../ui/pipes';
import { TopBarComponent } from '../../ui/top-bar.component';

@Component({
  selector: 'raf-profile',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, IonModal, IonToggle, TopBarComponent, IconComponent, DatePipe],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar title="Profil" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        @if (auth.user(); as u) {
          <section class="card pop-in">
            <div class="avatar">{{ initialsText() }}</div>
            <h1 class="title-stroke sm">{{ u.firstName }} {{ u.lastName }}</h1>
            <div class="since">Joueur depuis le {{ u.createdAt | date }}</div>
          </section>

          <section class="panel panel-with-ribbon">
            <div class="ribbon blue">Mon compte</div>
            <div class="list-row">
              <raf-icon name="mail" [size]="32" />
              <div class="grow">
                <div class="row-title">{{ u.email }}</div>
                <div class="row-sub">{{ u.emailVerified ? 'Email confirmé' : 'Email à confirmer' }}</div>
              </div>
              @if (u.emailVerified) {
                <raf-icon name="check" [size]="26" />
              } @else {
                <div class="email-actions">
                  <button class="btn3d sm" type="button" [disabled]="resending()" (click)="resendEmail()">Renvoyer</button>
                  <button class="btn3d blue sm" type="button" (click)="nav.navigateForward('/profil/email')">Corriger</button>
                </div>
              }
            </div>
            <div class="list-row">
              <raf-icon name="phone" [size]="32" />
              <div class="grow">
                <div class="row-title">{{ u.phone }}</div>
                <div class="row-sub">
                  {{ u.phoneVerified ? 'Téléphone vérifié' : u.emailVerified ? 'À vérifier pour retirer tes gains' : "Confirme d'abord ton email" }}
                </div>
              </div>
              @if (u.phoneVerified) {
                <raf-icon name="check" [size]="26" />
              } @else {
                <div class="email-actions">
                  @if (u.emailVerified) {
                    <button class="btn3d purple sm" type="button" (click)="nav.navigateForward('/profil/telephone')">Vérifier</button>
                  }
                  <button class="btn3d blue sm" type="button" (click)="nav.navigateForward('/profil/telephone/corriger')">Corriger</button>
                </div>
              }
            </div>
          </section>

          <section class="panel panel-with-ribbon">
            <div class="ribbon purple">Réglages</div>
            <div class="list-row">
              <raf-icon name="sound" [size]="32" />
              <span class="grow row-title">Sons du jeu</span>
              <ion-toggle [checked]="sound.enabled()" (ionChange)="sound.setEnabled($event.detail.checked)" aria-label="Sons du jeu" />
            </div>
            <button class="list-row clickable" type="button" (click)="nav.navigateForward('/alertes/reglages')">
              <raf-icon name="bell" [size]="32" />
              <span class="grow row-title">Notifications</span>
              <ion-icon name="chevron-forward" />
            </button>
            <button class="list-row clickable" type="button" (click)="nav.navigateForward('/profil/mot-de-passe')">
              <raf-icon name="key" [size]="32" />
              <span class="grow row-title">Mot de passe</span>
              <ion-icon name="chevron-forward" />
            </button>
            <button class="list-row clickable" type="button" (click)="nav.navigateForward('/profil/appareils')">
              <raf-icon name="device" [size]="32" />
              <span class="grow row-title">Appareils connectés</span>
              <ion-icon name="chevron-forward" />
            </button>
          </section>

          <section class="glass responsible">
            <raf-icon name="shield" [size]="36" />
            <p>RAF est réservé aux 18 ans et plus. Joue pour le plaisir, fixe-toi une limite et ne mise jamais l'argent dont tu as besoin.</p>
          </section>

          <button class="btn3d red block logout" type="button" (click)="logoutOpen.set(true)">
            <raf-icon name="logout" [size]="28" /> Se déconnecter
          </button>

          <button class="delete-link" type="button" (click)="nav.navigateForward('/profil/supprimer')">
            Supprimer mon compte
          </button>
        }
      </div>

      <ion-modal class="raf-popup" [isOpen]="logoutOpen()" (didDismiss)="logoutOpen.set(false)">
        <ng-template>
          <div class="panel popup">
            <div class="ribbon">Déconnexion</div>
            <p>Tu devras te reconnecter pour jouer sur cet appareil.</p>
            <button class="btn3d red block" type="button" (click)="logout()">Se déconnecter</button>
            <button class="btn3d blue block" type="button" (click)="logoutOpen.set(false)">Rester</button>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 8px;
      h1 { font-size: 26px; margin: 12px 0 2px; }
    }
    .avatar {
      width: 96px;
      height: 96px;
      border-radius: 30px;
      display: grid;
      place-items: center;
      border: 5px solid #fff;
      background: linear-gradient(180deg, #ffc078, #ff9a1a);
      box-shadow: 0 6px 0 var(--raf-edge-dark), 0 0 0 6px rgba(255, 192, 120, 0.4);
      font-family: var(--raf-font-display);
      font-size: 40px;
      -webkit-text-stroke: 6px rgba(120, 50, 0, 0.6);
      paint-order: stroke fill;
    }
    .since { font-weight: 800; color: var(--raf-ink-soft); }
    .grow { flex: 1; min-width: 0; }
    .row-title { overflow: hidden; text-overflow: ellipsis; }
    button.list-row {
      width: 100%;
      text-align: left;
      font-family: inherit;
      ion-icon { color: var(--raf-ink-soft); font-size: 20px; }
    }
    .responsible {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px;
      margin-top: 18px;
      p { margin: 0; font-weight: 700; font-size: 13.5px; line-height: 1.4; }
    }
    .logout { margin-top: 22px; }
    .email-actions { display: flex; flex-direction: column; gap: 6px; }
    // Discret volontairement : action rare et sans retour, a ne pas confondre avec la deconnexion.
    .delete-link {
      display: block;
      margin: 18px auto 6px;
      padding: 8px 12px;
      background: none;
      border: none;
      font-family: inherit;
      font-weight: 800;
      font-size: 14px;
      color: var(--raf-ink-soft);
      text-decoration: underline;
    }
    .popup {
      margin-top: 30px;
      display: grid;
      gap: 12px;
      text-align: center;
      p { margin: 0 0 6px; font-weight: 700; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  protected readonly nav = inject(NavController);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  protected readonly sound = inject(SoundService);

  protected readonly logoutOpen = signal(false);
  private readonly logoutModal = viewChild(IonModal);
  protected readonly resending = signal(false);
  protected readonly initialsText = computed(() => initials(this.auth.user()?.firstName, this.auth.user()?.lastName));

  ionViewWillEnter(): void {
    // Le profil a pu changer ailleurs (email confirme depuis un autre appareil).
    firstValueFrom(this.apiService.me())
      .then((user) => this.auth.setUser(user))
      .catch(() => undefined);
  }

  /** Changement d'onglet fenetre ouverte : elle ne doit pas reapparaitre par-dessus une autre page. */
  ionViewWillLeave(): void {
    void closeModal(this.logoutOpen, this.logoutModal());
  }

  protected async resendEmail(): Promise<void> {
    const email = this.auth.user()?.email;
    if (!email) {
      return;
    }
    this.resending.set(true);
    try {
      const response = await firstValueFrom(this.apiService.resendVerification(email));
      await this.feedback.success(response.message);
    } catch (e) {
      await this.feedback.error(e);
    } finally {
      this.resending.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await closeModal(this.logoutOpen, this.logoutModal());
    await this.auth.logout();
  }
}
