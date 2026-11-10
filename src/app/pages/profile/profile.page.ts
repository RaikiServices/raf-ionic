import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonModal, IonToggle, IonToolbar, NavController } from '@ionic/angular/standalone';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FeedbackService } from '../../core/feedback.service';
import { initials } from '../../core/format';
import { openHelp } from '../../core/help';
import { InstallService } from '../../core/install.service';
import { Invite } from '../../core/models';
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

          <button class="btn3d green block invite-btn" type="button" [disabled]="inviteLoading()" (click)="openInvite()">
            <raf-icon name="users" [size]="28" /> {{ inviteLoading() ? 'Chargement…' : 'Inviter un ami' }}
          </button>

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
                  <button class="btn3d green sm" type="button" (click)="nav.navigateForward('/profil/email/code')">Saisir le code</button>
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
            @if (!installed()) {
              <button class="list-row clickable" type="button" (click)="nav.navigateForward('/installer')">
                <raf-icon name="phone" [size]="32" />
                <span class="grow row-title">Installer l'application</span>
                <ion-icon name="chevron-forward" />
              </button>
            }
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

          <section class="panel panel-with-ribbon">
            <div class="ribbon green">Aide</div>
            <button class="list-row clickable" type="button" (click)="openHelp()">
              <raf-icon name="question" [size]="32" />
              <div class="grow">
                <div class="row-title">Aide et support</div>
                <div class="row-sub">Guide pas à pas, en français et en kreyòl</div>
              </div>
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

      <ion-modal #inviteModal class="raf-popup" [isOpen]="inviteOpen()" (didDismiss)="inviteOpen.set(false)">
        <ng-template>
          <div class="panel popup">
            <div class="ribbon gold">Inviter un ami</div>
            @if (invite(); as i) {
              <p>Fais scanner ce code à ton ami, ou envoie-lui le lien pour qu'il s'inscrive.</p>
              @if (i.leader && i.signupBonusCredits > 0) {
                <p class="bonus">
                  <raf-icon name="gift" [size]="26" />
                  Il recevra {{ i.signupBonusCredits }} crédits offerts dès qu'il aura confirmé son email.
                </p>
              }
              @if (qrCode(); as src) {
                <img class="qr" [src]="src" alt="Code QR du lien d'invitation" width="240" height="240" />
              }
              <div class="link">{{ i.url }}</div>
              <button class="btn3d block" type="button" (click)="copyInvite(i.url)">
                Copier le lien
              </button>
              @if (canShare) {
                <button class="btn3d purple block" type="button" (click)="shareInvite(i.url)">Partager</button>
              }
            }
            <button class="btn3d blue block" type="button" (click)="inviteOpen.set(false)">Fermer</button>
          </div>
        </ng-template>
      </ion-modal>

      <ion-modal #logoutModal class="raf-popup" [isOpen]="logoutOpen()" (didDismiss)="logoutOpen.set(false)">
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
    .invite-btn { margin: 4px 0 8px; }
    .qr {
      display: block;
      width: 240px;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
      padding: 10px;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 4px 0 var(--raf-edge-dark);
    }
    .bonus {
      display: flex;
      gap: 8px;
      align-items: center;
      text-align: left;
      color: var(--raf-green-dark);
    }
    .link {
      font-weight: 800;
      font-size: 13px;
      word-break: break-all;
      color: var(--raf-ink-soft);
    }
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
  private readonly install = inject(InstallService);
  protected readonly installed = computed(() => this.install.mode() === 'installed');

  protected readonly logoutOpen = signal(false);
  private readonly logoutModal = viewChild<IonModal>('logoutModal');
  protected readonly inviteOpen = signal(false);
  private readonly inviteModal = viewChild<IonModal>('inviteModal');
  protected readonly invite = signal<Invite | null>(null);
  protected readonly qrCode = signal<string | null>(null);
  protected readonly inviteLoading = signal(false);
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  protected readonly resending = signal(false);
  protected readonly openHelp = openHelp;
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
    void closeModal(this.inviteOpen, this.inviteModal());
  }

  /** Lien d'invitation (avec ce joueur pour parrain) et son code QR, demandes une seule fois. */
  protected async openInvite(): Promise<void> {
    if (!this.invite()) {
      this.inviteLoading.set(true);
      try {
        const invite = await firstValueFrom(this.apiService.invite());
        this.qrCode.set(await QRCode.toDataURL(invite.url, { width: 480, margin: 1, errorCorrectionLevel: 'M' }));
        this.invite.set(invite);
      } catch (e) {
        await this.feedback.error(e);
        return;
      } finally {
        this.inviteLoading.set(false);
      }
    }
    this.inviteOpen.set(true);
  }

  protected copyInvite(url: string): void {
    navigator.clipboard
      .writeText(url)
      .then(() => this.feedback.success("Lien d'invitation copié"))
      .catch(() => this.feedback.toast(url));
  }

  protected shareInvite(url: string): void {
    navigator
      .share({ title: 'RAF', text: 'Rejoins-moi sur RAF !', url })
      .catch(() => undefined);
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
