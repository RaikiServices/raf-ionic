import { WritableSignal } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';

/**
 * Ferme une fenetre (ion-modal en ligne, pilotee par [isOpen]) et attend la fin
 * de son animation.
 *
 * A appeler avant toute navigation qui quitte la page : mettre seulement le
 * signal a false puis naviguer aussitot laissait la fenetre affichee par-dessus
 * la page suivante (la page d'origine est masquee en pleine fermeture, et
 * l'animation ne se termine jamais).
 */
export async function closeModal(open: WritableSignal<boolean>, modal: IonModal | undefined): Promise<void> {
  open.set(false);
  try {
    await modal?.dismiss();
  } catch {
    // Deja fermee ou jamais ouverte : rien a faire.
  }
}
