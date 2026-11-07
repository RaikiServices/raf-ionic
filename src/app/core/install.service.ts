import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Ou en est l'installation de RAF sur l'ecran d'accueil, et donc quelles etapes montrer :
 * - installed : deja ouverte depuis l'icone (ou application Android / iOS), rien a faire ;
 * - prompt : Chrome (Android, ordinateur) propose l'installation en un bouton ;
 * - android : Android sans bouton (autre navigateur, ou Chrome ne l'a pas encore propose) ;
 * - ios-safari : iPhone / iPad dans Safari, via le bouton Partager ;
 * - ios-other : iPhone dans Chrome, Facebook, WhatsApp... : il faut d'abord passer par Safari ;
 * - desktop : ordinateur, sans bouton.
 */
export type InstallMode = 'installed' | 'prompt' | 'android' | 'ios-safari' | 'ios-other' | 'desktop';

/** Evenement non standard de Chrome / Edge (absent des types du DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/*
 * Installation de la PWA. Chrome n'envoie beforeinstallprompt qu'une fois, tot apres
 * le chargement : le service est cree au demarrage (AppComponent) pour ne pas le rater.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly promptReady = signal(false);
  private readonly justInstalled = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // On garde l'evenement pour notre propre bouton « Installer RAF ».
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.promptReady.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.promptReady.set(false);
      this.justInstalled.set(true);
    });
  }

  mode(): InstallMode {
    if (this.justInstalled() || isStandalone()) {
      return 'installed';
    }
    if (this.promptReady()) {
      return 'prompt';
    }
    const ua = navigator.userAgent;
    // iPadOS se presente comme un Mac : on le reconnait a l'ecran tactile.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) {
      // Chrome, Firefox, Edge et les navigateurs integres (Facebook, Instagram...) n'installent pas sur iOS.
      const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|GSA\//.test(ua);
      return otherBrowser ? 'ios-other' : 'ios-safari';
    }
    return /Android/.test(ua) ? 'android' : 'desktop';
  }

  /** Affiche la fenetre d'installation de Chrome ; true si le joueur a accepte. */
  async prompt(): Promise<boolean> {
    const event = this.deferred;
    if (!event) {
      return false;
    }
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Chrome ne permet qu'un appel par evenement.
    this.deferred = null;
    this.promptReady.set(false);
    if (outcome === 'accepted') {
      this.justInstalled.set(true);
    }
    return outcome === 'accepted';
  }
}

function isStandalone(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
