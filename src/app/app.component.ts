import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { AuthService } from './core/auth.service';
import { PlayerStateService } from './core/player-state.service';
import { AnnouncementPopupComponent } from './ui/announcement-popup.component';
import { EmailReminderComponent } from './ui/email-reminder.component';
import { IconDefsComponent } from './ui/icon.component';

@Component({
  selector: 'app-root',
  template: `
    <raf-icon-defs />
    <ion-app>
      <ion-router-outlet />
      <raf-email-reminder />
      <raf-announcement-popup />
    </ion-app>
  `,
  imports: [IonApp, IonRouterOutlet, IconDefsComponent, EmailReminderComponent, AnnouncementPopupComponent],
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly state = inject(PlayerStateService);
  private readonly router = inject(Router);

  constructor() {
    // Soldes et badge : charges a la connexion, oublies a la deconnexion.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.state.start();
      } else {
        this.state.stop();
      }
    });

    if (Capacitor.isNativePlatform()) {
      // Fond clair : texte de la barre d'etat en fonce.
      void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    }

    // Retour au premier plan : un gain ou une recharge a pu arriver entre-temps.
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.auth.isLoggedIn()) {
        this.state.refreshAll();
      }
    });

    // Clic sur une notification push alors que l'application est deja ouverte.
    navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'RAF_OPEN' && typeof event.data.path === 'string') {
        void this.router.navigateByUrl(event.data.path);
      }
    });
  }
}
