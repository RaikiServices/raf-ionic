import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonIcon, NavController } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { suggestEmail } from '../../core/email-typo';
import { FeedbackService } from '../../core/feedback.service';
import { storage } from '../../core/storage';
import { EmailSuggestionComponent } from '../../ui/email-suggestion.component';
import { IconComponent } from '../../ui/icon.component';
import { AuthLayoutComponent } from './auth-layout.component';

/** Parrain du lien d'invitation suivi, garde si le joueur quitte puis revient sur l'inscription. */
const INVITER_KEY = 'raf.inviter';

function parseInviter(raw: string | null): number | null {
  if (!raw || !/^\d{1,18}$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Numero haitien par defaut : le joueur tape ses 8 chiffres, ou un numero complet en +XXX. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) {
    return compact;
  }
  if (compact.startsWith('00')) {
    return '+' + compact.slice(2);
  }
  if (compact.startsWith('509') && compact.length === 11) {
    return '+' + compact;
  }
  return '+509' + compact;
}

@Component({
  selector: 'raf-register',
  imports: [FormsModule, IonIcon, AuthLayoutComponent, IconComponent, EmailSuggestionComponent],
  template: `
    <raf-auth-layout ribbon="Inscription" backTo="/bienvenue">
      <form (ngSubmit)="submit()" [class.shake]="shake()">
        @if (error(); as message) {
          <div class="alert-box">{{ message }}</div>
        }
        <div class="two">
          <label class="field">
            <span class="field-label">Prénom</span>
            <span class="input-box">
              <input name="firstName" [(ngModel)]="firstName" autocomplete="given-name" required /></span>
          </label>
          <label class="field">
            <span class="field-label">Nom</span>
            <span class="input-box"><input name="lastName" [(ngModel)]="lastName" autocomplete="family-name" required /></span>
          </label>
        </div>
        <label class="field">
          <span class="field-label">Email</span>
          <span class="input-box">
            <raf-icon name="mail" [size]="24" />
            <input type="email" name="email" [(ngModel)]="email" autocomplete="email" inputmode="email" placeholder="toi@exemple.com" required (blur)="checkEmail()" />
          </span>
          @if (emailSuggestion(); as suggestion) {
            <raf-email-suggestion [suggestion]="suggestion" (accept)="acceptEmail($event)" (keep)="keepEmail()" />
          } @else {
            <span class="field-hint">Pour te connecter et recevoir tes gains. Vérifie-la bien : on y envoie un lien de confirmation.</span>
          }
        </label>
        <label class="field">
          <span class="field-label">Téléphone</span>
          <span class="input-box">
            <raf-icon name="phone" [size]="24" />
            <span class="prefix">+509</span>
            <input type="tel" name="phone" [(ngModel)]="phone" autocomplete="tel-national" inputmode="tel" placeholder="3712 3456" required />
          </span>
          <span class="field-hint">Un code SMS le confirmera avant ton premier retrait.</span>
        </label>
        <label class="field">
          <span class="field-label">Mot de passe</span>
          <span class="input-box">
            <raf-icon name="key" [size]="24" />
            <input [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="8 caractères minimum" required />
            <button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer' : 'Afficher'">
              <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'" />
            </button>
          </span>
        </label>
        <label class="adult">
          <input type="checkbox" name="adult" [(ngModel)]="adult" />
          <span>J'ai <strong>18 ans ou plus</strong> et je joue de façon responsable.</span>
        </label>
        <button class="btn3d block lg" type="submit" [disabled]="busy()">
          {{ busy() ? 'Création…' : "C'est parti !" }}
        </button>
      </form>
      <div below class="below">
        <span>Déjà inscrit ?</span>
        <button class="btn3d blue sm" type="button" (click)="nav.navigateForward('/connexion')">Se connecter</button>
      </div>
    </raf-auth-layout>
  `,
  styles: `
    .two {
      // display: grid;
      // grid-template-columns: repeat(2,1fr);
      
      gap: 10px;
      width: 100%;
    }
    .adult {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin: 4px 4px 18px;
      font-weight: 700;
      font-size: 14px;
      line-height: 1.35;
      input {
        // width: 22px;
        // height: 22px;
        flex: none;
        accent-color: var(--raf-green-dark);
      }
    }
    .below {
      margin-top: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-weight: 800;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  protected readonly nav = inject(NavController);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected phone = '';
  protected password = '';
  protected adult = false;
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly shake = signal(false);
  /** Correction proposee pour l'email saisi (faute de frappe probable), affichee sous le champ. */
  protected readonly emailSuggestion = signal<string | null>(null);
  /** Adresse que le joueur a confirmee malgre la suggestion : on ne la lui propose plus. */
  private keptEmail: string | null = null;
  private inviterId: number | null = null;

  constructor() {
    // Lien d'invitation : /inscription?parrain=<id du joueur qui l'a partage>.
    const fromLink = parseInviter(inject(ActivatedRoute).snapshot.queryParamMap.get('parrain'));
    if (fromLink) {
      this.inviterId = fromLink;
      void storage.set(INVITER_KEY, String(fromLink));
    } else {
      void storage.get(INVITER_KEY).then((saved) => (this.inviterId = parseInviter(saved)));
    }
  }

  protected async submit(): Promise<void> {
    const problem = this.check();
    if (problem) {
      this.fail(problem);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.register({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        phone: normalizePhone(this.phone),
        password: this.password,
        ...(this.inviterId ? { inviterId: this.inviterId } : {}),
      });
      void storage.remove(INVITER_KEY);
      await this.nav.navigateRoot('/accueil', { animationDirection: 'forward' });
      await this.feedback.success('Bienvenue dans RAF ! Un email de confirmation t’attend.');
    } catch (e) {
      this.fail(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected checkEmail(): void {
    const email = this.email.trim();
    this.emailSuggestion.set(email && email !== this.keptEmail ? suggestEmail(email) : null);
  }

  protected acceptEmail(suggestion: string): void {
    this.email = suggestion;
    this.emailSuggestion.set(null);
    this.error.set(null);
  }

  protected keepEmail(): void {
    this.keptEmail = this.email.trim();
    this.emailSuggestion.set(null);
    this.error.set(null);
  }

  private check(): string | null {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      return 'Indique ton prénom et ton nom.';
    }
    this.checkEmail();
    if (this.emailSuggestion()) {
      return 'Vérifie ton adresse email : elle contient peut-être une faute.';
    }
    if (!/^\S+@\S+\.\S+$/.test(this.email.trim())) {
      return 'Cette adresse email ne semble pas valide.';
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(this.phone))) {
      return 'Numéro invalide : 8 chiffres pour Haïti, ou le numéro complet avec +.';
    }
    if (this.password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (!this.adult) {
      return 'RAF est réservé aux joueurs de 18 ans et plus.';
    }
    return null;
  }

  private fail(message: string): void {
    this.error.set(message);
    void this.feedback.buzz('error');
    this.shake.set(false);
    setTimeout(() => this.shake.set(true));
  }
}
