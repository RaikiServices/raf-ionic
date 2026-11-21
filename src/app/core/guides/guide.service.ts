import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { DriveStep, Driver, driver } from 'driver.js';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { t } from '../i18n';
import { GUIDES, Guide, GuideId, GuideStep } from './guides';

/** Delai maximum pour qu'un ecran ouvert par le guide affiche l'element a surligner. */
const ELEMENT_WAIT_MS = 1200;
/** Delai maximum pour qu'un ecran charge ce qui decide de l'affichage (options actives). */
const READY_WAIT_MS = 4000;

/**
 * Visites guidees de l'app (driver.js), sur les vrais ecrans.
 *
 * Chaque etape vise un element marque `data-guide="..."`. Quand une etape appartient
 * a un autre ecran, le guide l'ouvre lui-meme, attend que l'element apparaisse, puis
 * le surligne ; s'il n'apparait pas (pas de quiz ouvert, telephone non verifie...),
 * l'explication s'affiche au centre de l'ecran. Le guide ne fait que montrer : les
 * elements surlignes ne reagissent pas aux touches pendant la visite.
 *
 * Ionic garde en memoire les ecrans precedents (caches) : seul l'element visible
 * compte, jamais celui d'une page masquee.
 */
@Injectable({ providedIn: 'root' })
export class GuideService {
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);

  /** Une visite est affichee. */
  readonly running = signal(false);
  /** Fenetre « Visite guidee ? » ouverte apres l'inscription. */
  readonly offerOpen = signal(false);

  /** Guide de demarrage encore a proposer a ce compte (memorise cote serveur). */
  readonly onboardingPending = computed(() => !!this.auth.user()?.onboardingPending);
  /** Le rappel de confirmation de l'email attend la fin ou le refus du guide de demarrage. */
  readonly holdsReminders = computed(() => this.running() || this.offerOpen() || this.onboardingPending());

  private active: Driver | null = null;
  /** Changement d'etape en cours : un second toucher ne la relance pas. */
  private moving = false;

  readonly guides = GUIDES;

  constructor() {
    // Deconnexion pendant une visite : le voile du guide ne doit pas rester.
    effect(() => {
      if (!this.auth.user()) {
        untracked(() => this.stop());
      }
    });
  }

  /** Propose le guide de demarrage, une fois par visite de l'accueil, au compte concerne. */
  offerOnboarding(): void {
    if (this.onboardingPending() && !this.running()) {
      this.offerOpen.set(true);
    }
  }

  /** Reponse a la proposition : dans les deux cas, elle n'est plus faite sur aucun appareil. */
  async answerOffer(accept: boolean): Promise<void> {
    this.offerOpen.set(false);
    if (accept) {
      // Laisse la fenetre se fermer avant de poser le voile du guide.
      await delay(400);
      await this.start('demarrage');
    } else {
      await this.markOnboardingDone();
    }
  }

  async start(id: GuideId): Promise<void> {
    const guide = GUIDES.find((g) => g.id === id);
    if (!guide || this.running()) {
      return;
    }
    this.running.set(true);
    const first = guide.steps[0];
    if (first.route && !this.isOn(first.route)) {
      await this.goTo(first.route);
    }

    const drive = driver({
      // Etapes facultatives : leur nombre n'est connu qu'en chemin, pas de « 3 sur 7 » trompeur.
      showProgress: !guide.steps.some((step) => step.optional),
      progressText: t('{{current}} sur {{total}}'),
      nextBtnText: t('Suivant'),
      prevBtnText: t('Retour'),
      doneBtnText: t('Terminer'),
      closeBtnLabel: t('Quitter le guide'),
      allowClose: true,
      overlayClickBehavior: 'none',
      disableActiveInteraction: true,
      stagePadding: 6,
      stageRadius: 14,
      popoverClass: 'raf-guide',
      // L'ecran ouvert par le guide met un instant a afficher l'element : driver.js l'attend.
      waitForElement: ELEMENT_WAIT_MS,
      steps: guide.steps.map((step) => this.toDriveStep(step)),
      onNextClick: () => void this.move(drive, guide, 1),
      onPrevClick: () => void this.move(drive, guide, -1),
      onDestroyed: () => void this.finished(guide),
    });
    this.active = drive;
    drive.drive();
  }

  /** Quitte la visite en cours (deconnexion...). */
  stop(): void {
    this.active?.destroy();
  }

  /** Etape suivante ou precedente : ouvre d'abord son ecran s'il le faut. */
  private async move(drive: Driver, guide: Guide, delta: 1 | -1): Promise<void> {
    if (this.moving) {
      return;
    }
    this.moving = true;
    try {
      await this.moveNow(drive, guide, delta);
    } finally {
      // L'attente de l'element par driver.js se termine apres moveTo.
      setTimeout(() => (this.moving = false), ELEMENT_WAIT_MS);
    }
  }

  private async moveNow(drive: Driver, guide: Guide, delta: 1 | -1): Promise<void> {
    let target = (drive.getActiveIndex() ?? 0) + delta;
    for (;;) {
      if (target >= guide.steps.length) {
        drive.destroy();
        return;
      }
      if (target < 0) {
        return;
      }
      const route = routeOf(guide, target);
      if (route && !this.isOn(route)) {
        await this.goTo(route);
      }
      await this.waitReady(readyOf(guide, target));
      const step = guide.steps[target];
      // Fonction coupee dans le back-office (ou indisponible) : son etape est sautee.
      if (step.optional && step.element && !visible(step.element)) {
        target += delta;
        continue;
      }
      break;
    }
    drive.moveTo(target);
  }

  /** Attend que l'ecran signale la fin de son chargement (data-guide-ready), quelques secondes au plus. */
  private async waitReady(name: string | undefined): Promise<void> {
    if (!name) {
      return;
    }
    const deadline = Date.now() + READY_WAIT_MS;
    while (!visible(name, 'data-guide-ready') && Date.now() < deadline) {
      await delay(100);
    }
  }


  private toDriveStep(step: GuideStep): DriveStep {
    return {
      // Element absent (ou pas encore affiche a la fin de l'attente) : explication au centre.
      element: step.element ? () => visible(step.element!) as Element : undefined,
      popover: {
        title: t(step.title),
        description: t(step.text),
        side: step.side,
        align: 'center',
      },
    };
  }

  private async finished(guide: Guide): Promise<void> {
    this.active = null;
    this.running.set(false);
    if (guide.id === 'demarrage' && this.onboardingPending()) {
      await this.markOnboardingDone();
    }
  }

  private async markOnboardingDone(): Promise<void> {
    try {
      await this.auth.setUser(await firstValueFrom(this.apiService.onboardingDone()));
    } catch {
      // Reseau coupe : le guide sera repropose a la prochaine ouverture, sans gravite.
    }
  }

  private isOn(route: string): boolean {
    return this.router.url === route;
  }

  /** Sans animation : l'element est mesure a sa place definitive. */
  private async goTo(route: string): Promise<void> {
    const tab = route.split('?')[0];
    const root = ['/accueil', '/tickets', '/portefeuille', '/alertes', '/profil'].includes(tab);
    await (root
      ? this.nav.navigateRoot(route, { animated: false })
      : this.nav.navigateForward(route, { animated: false }));
    await delay(150);
  }
}

/** Signal de chargement attendu par une etape : celui de l'etape qui a ouvert son ecran. */
function readyOf(guide: Guide, index: number): string | undefined {
  for (let i = index; i >= 0; i--) {
    if (guide.steps[i].route) {
      return guide.steps[i].ready;
    }
  }
  return undefined;
}

/** Ecran d'une etape : le sien, sinon celui de l'etape precedente qui en a un. */
function routeOf(guide: Guide, index: number): string | undefined {
  for (let i = index; i >= 0; i--) {
    if (guide.steps[i].route) {
      return guide.steps[i].route;
    }
  }
  return undefined;
}

function visible(name: string, attribute = 'data-guide'): Element | null {
  const all = Array.from(document.querySelectorAll(`[${attribute}="${name}"]`));
  return (
    all.find((el) => {
      const rect = el.getBoundingClientRect();
      // Ecran cache par Ionic : l'element est dans une page marquee ion-page-hidden.
      return rect.width > 0 && rect.height > 0 && !el.closest('.ion-page-hidden');
    }) ?? null
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
