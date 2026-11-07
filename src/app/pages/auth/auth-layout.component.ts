import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonContent, NavController } from '@ionic/angular/standalone';

import { HelpTopic, openHelp } from '../../core/help';
import { IconComponent } from '../../ui/icon.component';

/** Mise en page des ecrans sans compte : ciel, logo, panneau creme a ruban. */
@Component({
  selector: 'raf-auth-layout',
  imports: [IonContent, IconComponent],
  template: `
    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="wrap">
        @if (backTo(); as target) {
          <button class="btn3d sm icon-only back" type="button" aria-label="Retour" (click)="nav.navigateBack(target)">
            <raf-icon name="back" [size]="20" />
          </button>
        }
        <img class="logo pop-in" src="assets/logo-raf.png" alt="RAF" />
        <section class="panel panel-with-ribbon slide-up">
          <div [class]="'ribbon ' + ribbonColor()">{{ ribbon() }}</div>
          <ng-content />
        </section>
        <ng-content select="[below]" />
        <button class="link-btn ink help" type="button" (click)="openHelp(helpTopic())">
          <raf-icon name="question" [size]="20" /> Besoin d'aide ?
        </button>
      </div>
    </ion-content>
  `,
  styles: `
    .help {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 22px auto 0;
    }
    // L'element hote ne doit pas s'intercaler entre la page Ionic et son ion-content.
    :host { display: contents; }
    .wrap {
      position: relative;
      max-width: 440px;
      margin: 0 auto;
      padding: calc(24px + var(--raf-safe-top)) 18px calc(32px + var(--raf-safe-bottom));
    }
    .back {
      position: absolute;
      top: calc(14px + var(--raf-safe-top));
      left: 16px;
      z-index: 2;
    }
    .logo {
      display: block;
      width: 190px;
      margin: 14px auto 18px;
      filter: drop-shadow(0 5px 0 rgba(184, 106, 0, 0.45)) drop-shadow(0 0 2px #fff);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  protected readonly nav = inject(NavController);

  readonly ribbon = input.required<string>();
  readonly ribbonColor = input<'' | 'blue' | 'green' | 'purple' | 'gold'>('');
  readonly backTo = input<string | null>(null);
  /** Sujet du guide d'aide ouvert par « Besoin d'aide ? » ; sans sujet, la liste des sujets. */
  readonly helpTopic = input<HelpTopic | undefined>(undefined);
  protected readonly openHelp = openHelp;
}
