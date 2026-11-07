import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';
import { FeedbackService } from '../../core/feedback.service';
import { openHelp } from '../../core/help';
import { InstallMode, InstallService } from '../../core/install.service';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

interface Step {
  text: string;
  /** Icone Ionicons a reconnaitre a l'ecran (bouton Partager, menu ⋮). */
  icon?: string;
}

const STEPS: Record<Exclude<InstallMode, 'installed' | 'prompt'>, Step[]> = {
  android: [
    { text: 'Touche les 3 petits points en haut à droite de Chrome.', icon: 'ellipsis-vertical' },
    { text: 'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».' },
    { text: 'Touche « Installer » pour confirmer.' },
    { text: 'L’icône RAF apparaît avec tes autres applications : ouvre RAF depuis cette icône.' },
  ],
  'ios-safari': [
    { text: 'Touche le bouton Partager, en bas de l’écran (le carré avec une flèche vers le haut).', icon: 'share-outline' },
    { text: 'Fais glisser la liste vers le haut et choisis « Sur l’écran d’accueil ».' },
    { text: 'Touche « Ajouter » en haut à droite.' },
    { text: 'L’icône RAF apparaît sur ton écran d’accueil : ouvre RAF depuis cette icône.' },
  ],
  'ios-other': [
    { text: 'Sur iPhone, RAF s’installe seulement avec Safari. Touche « Copier le lien » ci-dessous.' },
    { text: 'Ouvre l’application Safari (la boussole bleue).' },
    { text: 'Touche la barre d’adresse, colle le lien et ouvre-le.' },
    { text: 'Safari affiche alors les étapes pour installer RAF.' },
  ],
  desktop: [
    { text: 'Ouvre RAF dans Chrome ou Edge.' },
    { text: 'Clique sur l’icône d’installation à droite de la barre d’adresse.' },
    { text: 'Confirme « Installer » : RAF s’ouvre dans sa propre fenêtre.' },
  ],
};

/** Guide d'installation sur l'ecran d'accueil, adapte au telephone et au navigateur du joueur. */
@Component({
  selector: 'raf-install',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar>
        <raf-top-bar [back]="auth.isLoggedIn() ? '/profil' : '/bienvenue'" title="Installer" [showWallet]="false" />
      </ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <section class="panel panel-with-ribbon">
          <div class="ribbon gold">Installer RAF</div>

          @switch (mode()) {
            @case ('installed') {
              <div class="done">
                <raf-icon class="pop-in" name="check" [size]="72" />
                <p class="lead">RAF est installée sur cet appareil.</p>
                <p class="sub">Ouvre toujours RAF depuis son icône sur l’écran d’accueil pour recevoir les notifications.</p>
              </div>
            }
            @case ('prompt') {
              <p class="lead">Ajoute RAF à ton écran d’accueil, comme une vraie application.</p>
              <button class="btn3d green block lg" type="button" [disabled]="busy()" (click)="installNow()">
                <raf-icon name="phone" [size]="26" /> Installer RAF
              </button>
              <p class="sub">Une fenêtre s’ouvre : touche « Installer ».</p>
            }
            @default {
              <p class="lead">{{ intro() }}</p>
              <ol class="steps">
                @for (step of steps(); track step.text; let n = $index) {
                  <li>
                    <span class="num">{{ n + 1 }}</span>
                    <span class="grow">{{ step.text }}</span>
                    @if (step.icon) {
                      <ion-icon class="hint-icon" [name]="step.icon" aria-hidden="true" />
                    }
                  </li>
                }
              </ol>
              @if (mode() === 'ios-other') {
                <button class="btn3d block" type="button" (click)="copyLink()">Copier le lien</button>
              }
            }
          }
        </section>

        @if (mode() !== 'installed') {
          <section class="glass why">
            <raf-icon name="bell" [size]="36" />
            <p>Une fois installée, RAF peut te prévenir du début des quiz, des résultats et de tes gains.
              @if (isIos()) { Sur iPhone, les notifications marchent <strong>seulement</strong> si RAF est installée. }
            </p>
          </section>
        }

        <button class="link-btn ink help" type="button" (click)="help()">Toujours bloqué ? Besoin d'aide</button>
      </div>
    </ion-content>
  `,
  styles: `
    .lead { font-weight: 900; font-size: 17px; margin: 0 0 14px; text-align: center; }
    .sub { font-weight: 700; color: var(--raf-ink-soft); text-align: center; margin: 12px 0 0; }
    .done { text-align: center; }
    .steps { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 12px; }
    .steps li { display: flex; gap: 12px; align-items: center; font-weight: 800; font-size: 15px; line-height: 1.4; }
    .grow { flex: 1; min-width: 0; }
    .num {
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #ffc078, var(--raf-primary));
      border: 3px solid #fff;
      box-shadow: 0 3px 0 var(--raf-edge-dark);
      color: #fff;
      font-family: var(--raf-font-display);
    }
    .hint-icon {
      flex: none;
      font-size: 26px;
      padding: 6px;
      border-radius: 10px;
      background: #fff;
      color: #007aff;
      box-shadow: 0 2px 0 var(--raf-edge);
    }
    .help { display: block; margin: 18px auto 0; }
    .why {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px;
      margin-top: 18px;
      p { margin: 0; font-weight: 700; font-size: 13.5px; line-height: 1.4; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallPage {
  protected readonly auth = inject(AuthService);
  private readonly install = inject(InstallService);
  private readonly feedback = inject(FeedbackService);

  protected readonly busy = signal(false);
  protected readonly mode = computed(() => this.install.mode());
  protected readonly isIos = computed(() => this.mode() === 'ios-safari' || this.mode() === 'ios-other');
  protected readonly steps = computed(() => {
    const mode = this.mode();
    return mode === 'installed' || mode === 'prompt' ? [] : STEPS[mode];
  });
  protected readonly intro = computed(() =>
    this.mode() === 'ios-other' ? 'Tu utilises un autre navigateur que Safari.' : 'Suis ces étapes, ça prend 30 secondes.',
  );

  protected help(): void {
    openHelp('installer');
  }

  protected async installNow(): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.install.prompt()) {
        await this.feedback.success('RAF est installée ! Retrouve-la sur ton écran d’accueil.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected copyLink(): void {
    // Lien direct vers ce guide : dans Safari, il affichera les etapes du bouton Partager.
    const url = new URL('installer', document.baseURI).href;
    navigator.clipboard
      .writeText(url)
      .then(() => this.feedback.success('Lien copié. Colle-le dans Safari.'))
      .catch(() => this.feedback.toast(url));
  }
}
