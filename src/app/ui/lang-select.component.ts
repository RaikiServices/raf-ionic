import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LANGS, Lang, lang, setLang } from '../core/i18n';

/** Choix de la langue : Francais ou Kreyol. Garde sur l'appareil. */
@Component({
  selector: 'raf-lang-select',
  template: `
    <label class="lang">
      <span class="sr-only">Langue / Lang</span>
      <span class="globe" aria-hidden="true">🌐</span>
      <select [value]="current()" (change)="choose($event)">
        @for (option of langs; track option.value) {
          <option [value]="option.value" [selected]="option.value === current()">{{ option.label }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    .lang {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #fff;
      border: 3px solid var(--raf-p200, #ffd8a8);
      box-shadow: 0 3px 0 var(--raf-p200, #ffd8a8);
      font-weight: 900;
    }
    select {
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--raf-ink, #3b2a1a);
      cursor: pointer;
      outline: none;
    }
    .globe { font-size: 1rem; line-height: 1; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LangSelectComponent {
  protected readonly langs = LANGS;
  protected readonly current = lang;

  protected choose(event: Event): void {
    setLang((event.target as HTMLSelectElement).value as Lang);
  }
}
