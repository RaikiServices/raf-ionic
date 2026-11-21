import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { SocialService } from '../core/social.service';
import { IconComponent } from './icon.component';
import { TPipe } from '../core/i18n';

/**
 * Invitation a suivre Raiki Services sur Instagram. N'apparait que si le lien
 * est active dans le back-office ; l'abonnement n'est jamais une condition pour
 * jouer.
 *
 *   thanks : apres un ticket ou une partie offerts, en guise de merci.
 *   news   : en fin de partie, la ou sont annonces gagnants et prochains quiz.
 */
@Component({
  selector: 'raf-instagram-card',
  imports: [TPipe, IconComponent],
  template: `
    @if (social.instagramUrl(); as url) {
      <a class="insta" [href]="url" target="_blank" rel="noopener">
        <raf-icon name="instagram" [size]="44" />
        <span class="text">
          @if (variant() === 'thanks') {
            <strong>{{ 'C’est offert !' | t }}</strong>
            <span>{{ 'Pour nous dire merci, suis Raiki Services sur Instagram.' | t }}</span>
          } @else {
            <strong>{{ 'Gagnants et prochains quiz' | t }}</strong>
            <span>{{ 'Tout est annoncé en premier sur notre Instagram.' | t }}</span>
          }
        </span>
        <span class="go">{{ 'Suivre' | t }}</span>
      </a>
    }
  `,
  styles: `
    .insta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 14px 0 0;
      padding: 10px 12px;
      border-radius: 16px;
      background: #fff;
      border: 2px solid #f3c1da;
      box-shadow: 0 4px 0 #f3c1da;
      color: var(--raf-ink);
      text-decoration: none;
      text-align: left;
    }
    .insta:active { transform: translateY(2px); box-shadow: 0 2px 0 #f3c1da; }
    .text { flex: 1; display: grid; gap: 2px; font-size: 13px; font-weight: 700; line-height: 1.3; }
    .text strong { font-family: var(--raf-font-display, inherit); font-size: 16px; font-weight: 400; }
    .go {
      flex: none;
      padding: 6px 12px;
      border-radius: 999px;
      background: linear-gradient(90deg, #ff5a3c, #e0287d 60%, #8a3ab9);
      color: #fff;
      font-weight: 900;
      font-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstagramCardComponent {
  protected readonly social = inject(SocialService);

  readonly variant = input<'thanks' | 'news'>('news');

  constructor() {
    this.social.load();
  }
}
