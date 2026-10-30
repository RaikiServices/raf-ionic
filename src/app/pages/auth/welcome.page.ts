import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent, NavController } from '@ionic/angular/standalone';

import { FeedbackService } from '../../core/feedback.service';
import { IconComponent } from '../../ui/icon.component';

/** Ecran d'accueil sans compte : la promesse du jeu en trois etapes. */
@Component({
  selector: 'raf-welcome',
  imports: [IonContent, IconComponent],
  template: `
    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="wrap">
        <div class="sparkles" aria-hidden="true">
          <raf-icon class="s1 float" name="question" [size]="44" />
          <raf-icon class="s2 float" name="star" [size]="34" />
          <raf-icon class="s3 float" name="coin" [size]="40" />
          <raf-icon class="s4 float" name="trophy" [size]="46" />
        </div>

        <img class="logo pop-in" src="assets/logo-raf.png" alt="RAF" />
        <h1 class="title-stroke tagline slide-up">Réponds. Monte au classement.<br /><span class="text-gold">Gagne !!!</span></h1>

        <div class="steps stagger">
          <div class="step glass">
            <raf-icon name="ticket" [size]="42" />
            <div><strong>Prends un ticket</strong><span>pour le quiz de ton choix</span></div>
          </div>
          <div class="step glass">
            <raf-icon name="clock" [size]="42" />
            <div><strong>Réponds vite et juste</strong><span>avant la fin du chrono</span></div>
          </div>
          <div class="step glass">
            <raf-icon name="trophy" [size]="42" />
            <div><strong>Monte au classement</strong><span>les meilleurs gagnent de l'argent</span></div>
          </div>
        </div>

        <div class="actions">
          <button class="btn3d lg block pulse" type="button" (click)="go('/inscription')">
            <!-- <raf-icon name="play" [size]="24" />  -->
            Creer un compte
          </button>
          <button class="btn3d blue block" type="button" (click)="go('/connexion')">J'ai déjà un compte</button>
        </div>
        <p class="legal">Réservé aux 18 ans et plus. Joue de façon responsable.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .wrap {
      position: relative;
      max-width: 440px;
      min-height: 100%;
      margin: 0 auto;
      padding: calc(36px + var(--raf-safe-top)) 20px calc(24px + var(--raf-safe-bottom));
      display: flex;
      flex-direction: column;
    }
    .logo {
      display: block;
      width: 240px;
      margin: 18px auto 10px;
      filter: drop-shadow(0 6px 0 rgba(184, 106, 0, 0.45)) drop-shadow(0 0 2px #fff);
    }
    .tagline {
      text-align: center;
      font-size: 32px;
      line-height: 1.1;
      margin: 8px 0 22px;
    }
    .steps {
      display: grid;
      gap: 10px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      strong {
        display: block;
        font-family: var(--raf-font-display);
        font-weight: 400;
        font-size: 18px;
      }
      span {
        font-weight: 700;
        opacity: 0.85;
        font-size: 14px;
      }
    }
    .actions {
      margin-top: auto;
      padding-top: 26px;
      display: grid;
      gap: 16px;
    }
    .legal {
      text-align: center;
      font-size: 12.5px;
      font-weight: 700;
      opacity: 0.75;
      margin: 18px 0 0;
    }
    .sparkles raf-icon {
      position: absolute;
      opacity: 0.9;
    }
    .s1 { top: calc(40px + var(--raf-safe-top)); left: 14px; animation-delay: -0.6s; }
    .s2 { top: calc(150px + var(--raf-safe-top)); right: 26px; animation-delay: -1.4s; }
    .s3 { top: calc(24px + var(--raf-safe-top)); right: 40px; animation-delay: -2.1s; }
    .s4 { top: calc(160px + var(--raf-safe-top)); left: 22px; animation-delay: -0.2s; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePage {
  private readonly nav = inject(NavController);
  private readonly feedback = inject(FeedbackService);

  protected go(url: string): void {
    this.feedback.tap();
    void this.nav.navigateForward(url);
  }
}
