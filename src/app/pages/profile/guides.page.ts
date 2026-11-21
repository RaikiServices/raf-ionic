import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular/standalone';

import { GuideService } from '../../core/guides/guide.service';
import { GuideId } from '../../core/guides/guides';
import { openHelp } from '../../core/help';
import { TPipe } from '../../core/i18n';
import { IconComponent } from '../../ui/icon.component';
import { TopBarComponent } from '../../ui/top-bar.component';

/**
 * Aide et support : les tutoriels interactifs de l'app (GuideService), puis le guide
 * d'aide du site et le contact WhatsApp pour qui reste bloque.
 */
@Component({
  selector: 'raf-guides',
  imports: [TPipe, IonHeader, IonToolbar, IonContent, IonIcon, TopBarComponent, IconComponent],
  template: `
    <ion-header class="raf-header">
      <ion-toolbar><raf-top-bar back="/profil" [title]="'Guides' | t" [showWallet]="false" /></ion-toolbar>
    </ion-header>

    <ion-content class="raf-sky" [fullscreen]="true">
      <div class="page-pad">
        <p class="intro">{{ 'Choisis un guide : il te montre les vrais boutons, écran par écran. Rien n’est acheté ni envoyé pendant le guide.' | t }}</p>

        <div class="list stagger">
          @for (g of guides.guides; track g.id) {
            <button class="guide panel" type="button" (click)="start(g.id)">
              <raf-icon [name]="g.icon" [size]="44" />
              <span class="grow">
                <span class="title">{{ g.title | t }}</span>
                <span class="sub">{{ g.summary | t }}</span>
              </span>
              <ion-icon name="chevron-forward" />
            </button>
          }
        </div>

        <section class="glass stuck">
          <raf-icon name="question" [size]="40" />
          <div class="grow">
            <strong>{{ 'Toujours bloqué ?' | t }}</strong>
            <span>{{ 'Email, installation, notifications, mot de passe : le guide d’aide pas à pas, puis un agent RAF sur WhatsApp.' | t }}</span>
          </div>
        </section>
        <button class="btn3d blue block" type="button" (click)="help()">{{ 'Ouvrir le guide d’aide' | t }}</button>
      </div>
    </ion-content>
  `,
  styles: `
    .intro { font-weight: 800; margin: 0 4px 14px; line-height: 1.4; }
    .list { display: grid; gap: 12px; margin-bottom: 22px; }
    .guide {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
      &:active { transform: translateY(3px); }
    }
    .grow { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .title { font-family: var(--raf-font-display); font-size: 19px; }
    .sub { font-weight: 700; font-size: 13.5px; color: var(--raf-ink-soft); line-height: 1.35; }
    ion-icon { color: var(--raf-ink-soft); font-size: 20px; flex: none; }
    .stuck {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      margin-bottom: 12px;
      strong { display: block; font-family: var(--raf-font-display); font-weight: 400; font-size: 18px; }
      span { font-weight: 700; font-size: 13px; line-height: 1.4; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesPage {
  protected readonly guides = inject(GuideService);

  protected start(id: GuideId): void {
    void this.guides.start(id);
  }

  protected help(): void {
    openHelp();
  }
}
