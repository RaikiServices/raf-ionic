import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonModal, NavController } from '@ionic/angular/standalone';
import { filter, firstValueFrom, map } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { confirmEmailCode } from '../core/email-verification';
import { errorMessage } from '../core/errors';
import { FeedbackService } from '../core/feedback.service';
import { openHelp } from '../core/help';
import { IconComponent } from './icon.component';
import { closeModal } from './modal';

/** Delai entre deux rappels (et entre deux verifications du profil). */
const REMINDER_DELAY_MS = 10_000;

/**
 * Ecrans ou le rappel ne s'affiche pas : partie en cours (chronometree), lien de
 * confirmation en train d'etre traite, correction de l'email, suppression du compte.
 */
const QUIET_ROUTES = [/^\/quiz\/[^/]+\/jouer/, /^\/verification-email/, /^\/profil\/email/, /^\/profil\/supprimer/];

/*
 * Rappel de confirmation de l'email.
 *
 * Tant que l'email du joueur connecte n'est pas confirme, une fenetre le guide
 * toutes les 10 secondes apres sa fermeture. Le profil est relu a chaque passage :
 * des que le lien a ete ouvert (dans le navigateur, sur un autre appareil...),
 * la fenetre se ferme d'elle-meme et ne revient plus.
 *
 * Le rappel peut etre coupe depuis le back-office (App joueur) : le reglage est
 * relu a chaque passage, une fenetre ouverte se ferme alors au passage suivant.
 */
@Component({
  selector: 'raf-email-reminder',
  imports: [FormsModule, IonModal, IconComponent],
  template: `
    <ion-modal class="raf-popup" [isOpen]="open()" [backdropDismiss]="false" (didDismiss)="dismissed()">
      <ng-template>
        <div class="panel popup">
          <button class="popup-close" type="button" aria-label="Plus tard" (click)="later()">
            <raf-icon name="close" [size]="22" />
          </button>
          <div class="ribbon purple">Confirme ton email</div>
          <div class="popup-art">
            <raf-icon class="float" name="mail" [size]="88" />
          </div>
          <p class="lead">Un email de confirmation a été envoyé à</p>
          <p class="address">{{ email() }}</p>

          <ol class="steps">
            <li><span class="num">1</span><span>Ouvre l'email de <strong>RAF</strong> dans ta boîte mail.</span></li>
            <li><span class="num">2</span><span>Saisis ici le <strong>code à 6 chiffres</strong>, ou touche le lien de confirmation.</span></li>
            <li><span class="num">3</span><span>Pas d'email ? Regarde dans <strong>Spam</strong> ou <strong>Promotions</strong>, ou renvoie-le.</span></li>
          </ol>

          <input class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" name="code"
                 aria-label="Code reçu par email" [(ngModel)]="code" placeholder="······" (keyup.enter)="submitCode()" />
          @if (codeError(); as message) {
            <div class="alert-box code-error">{{ message }}</div>
          }
          <button class="btn3d green block code-btn" type="button" [disabled]="verifying()" (click)="submitCode()">
            <raf-icon name="check" [size]="24" /> {{ verifying() ? 'Vérification…' : 'Valider le code' }}
          </button>

          <div class="alert-box info">Sans email confirmé, tu ne pourras pas vérifier ton téléphone ni retirer tes gains.</div>

          <button class="btn3d block" type="button" [disabled]="checking()" (click)="checkNow()">J'ai touché le lien</button>
          <button class="btn3d block" type="button" [disabled]="resending()" (click)="resend()">Renvoyer l'email</button>
          <button class="btn3d blue block" type="button" (click)="correct()">Mon email est faux</button>
          <button class="link-btn ink help" type="button" (click)="help()">Besoin d'aide ?</button>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .popup { margin-top: 30px; padding-top: 26px; }
    .help { display: block; margin: 10px auto 0; }
    .popup-art { display: grid; place-items: center; margin: 4px 0 10px; }
    .lead { text-align: center; font-weight: 800; margin: 0; }
    .address { text-align: center; font-weight: 900; font-size: 17px; margin: 2px 0 12px; word-break: break-all; }
    .steps { list-style: none; padding: 0; margin: 0 0 12px; display: grid; gap: 8px; }
    .steps li { display: flex; gap: 10px; align-items: flex-start; font-weight: 700; font-size: 14px; line-height: 1.35; }
    .num {
      flex: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--raf-p200);
      font-weight: 900;
      font-size: 13px;
    }
    button.block + button.block { margin-top: 10px; }
    .code-error { margin-top: 10px; }
    .code-btn { margin: 12px 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailReminderComponent {
  protected help(): void {
    openHelp('email');
  }

  private readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly nav = inject(NavController);
  private readonly router = inject(Router);
  private readonly modal = viewChild(IonModal);

  protected readonly open = signal(false);
  protected readonly checking = signal(false);
  protected readonly resending = signal(false);
  protected readonly verifying = signal(false);
  protected readonly codeError = signal<string | null>(null);
  protected code = '';
  protected readonly email = computed(() => this.auth.user()?.email ?? '');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly quiet = computed(() => QUIET_ROUTES.some((r) => r.test(this.url())));
  private readonly pending = computed(() => {
    const user = this.auth.user();
    return user !== null && !user.emailVerified;
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Dernier reglage connu du back-office ; actif tant qu'il n'a pas pu etre lu. */
  private reminderEnabled = true;

  constructor() {
    // Rappels actifs seulement pour un joueur connecte dont l'email n'est pas confirme.
    effect(() => {
      if (this.pending()) {
        this.schedule();
      } else {
        this.cancel();
        void closeModal(this.open, this.modal());
      }
    });
    // Arrivee sur un ecran ou il ne faut pas deranger : la fenetre se retire.
    effect(() => {
      if (this.quiet() && this.open()) {
        void closeModal(this.open, this.modal());
      }
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  protected later(): void {
    void closeModal(this.open, this.modal());
  }

  /** Fenetre fermee : le prochain rappel arrive 10 secondes plus tard, pas avant. */
  protected dismissed(): void {
    this.open.set(false);
    this.cancel();
    if (this.pending()) {
      this.schedule();
    }
  }

  protected async checkNow(): Promise<void> {
    this.checking.set(true);
    try {
      if (await this.refresh()) {
        return;
      }
      await this.feedback.toast("Ton email n'est pas encore confirmé. Saisis le code ou touche le lien reçu par email.", 'error');
    } finally {
      this.checking.set(false);
    }
  }

  protected async submitCode(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      this.codeError.set('Saisis les 6 chiffres reçus par email.');
      return;
    }
    this.verifying.set(true);
    this.codeError.set(null);
    try {
      await confirmEmailCode(this.apiService, this.auth, code);
      this.code = '';
      await closeModal(this.open, this.modal());
      await this.feedback.success('Email confirmé, merci !');
    } catch (e) {
      this.codeError.set(errorMessage(e));
      void this.feedback.buzz('error');
    } finally {
      this.verifying.set(false);
    }
  }

  protected async resend(): Promise<void> {
    const email = this.email();
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

  protected async correct(): Promise<void> {
    await closeModal(this.open, this.modal());
    await this.nav.navigateForward('/profil/email');
  }

  private schedule(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, REMINDER_DELAY_MS);
  }

  private cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Relit le profil ; ouvre la fenetre si l'email n'est toujours pas confirme. */
  private async tick(): Promise<void> {
    if (!this.pending()) {
      return;
    }
    if (!(await this.refreshEnabled())) {
      // Rappel coupe dans le back-office : on continue de surveiller le reglage.
      await closeModal(this.open, this.modal());
      this.schedule();
      return;
    }
    const verified = await this.refresh();
    if (verified || !this.pending()) {
      return;
    }
    if (!this.open() && !this.quiet()) {
      this.open.set(true);
    }
    this.schedule();
  }

  /** Relit le reglage du back-office ; hors ligne, garde le dernier connu. */
  private async refreshEnabled(): Promise<boolean> {
    try {
      this.reminderEnabled = (await firstValueFrom(this.apiService.appConfig())).emailReminderEnabled;
    } catch {
      // Hors ligne : dernier reglage connu.
    }
    return this.reminderEnabled;
  }

  /** Vrai si l'email vient d'etre confirme (la fenetre est alors fermee et le joueur felicite). */
  private async refresh(): Promise<boolean> {
    try {
      const user = await firstValueFrom(this.apiService.me());
      if (!this.auth.isLoggedIn()) {
        return false;
      }
      await this.auth.setUser(user);
      if (user.emailVerified) {
        await closeModal(this.open, this.modal());
        await this.feedback.success('Email confirmé, merci !');
        return true;
      }
    } catch {
      // Hors ligne : on reessaiera au prochain passage.
    }
    return false;
  }
}
