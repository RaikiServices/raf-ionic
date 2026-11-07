import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from './icon.component';

/**
 * « Tu voulais dire jean@gmail.com ? », sous un champ email (voir core/email-typo.ts).
 * La page decide quand l'afficher : en quittant le champ et a l'envoi du formulaire,
 * pas pendant la saisie (« jean@gmail » serait signale avant d'avoir tape « .com »).
 */
@Component({
  selector: 'raf-email-suggestion',
  imports: [IconComponent],
  template: `
    <div class="alert-box warn suggestion pop-in" role="alert">
      <raf-icon name="warning" [size]="26" />
      <div class="grow">
        <div>Tu voulais dire</div>
        <strong>{{ suggestion() }}</strong> ?
        <div class="actions">
          <button class="btn3d green sm" type="button" (click)="accept.emit(suggestion())">Oui, corriger</button>
          <button class="btn3d blue sm" type="button" (click)="keep.emit()">Non, c'est bon</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .suggestion { margin: 8px 0 0; }
    .grow { flex: 1; min-width: 0; }
    strong { overflow-wrap: anywhere; font-size: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailSuggestionComponent {
  readonly suggestion = input.required<string>();
  readonly accept = output<string>();
  readonly keep = output<void>();
}
