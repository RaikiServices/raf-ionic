import { Pipe, PipeTransform } from '@angular/core';

import { formatAgo, formatDate, formatDateTime, formatHtg, formatNumber } from '../core/format';

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatNumber(value);
  }
}

@Pipe({ name: 'htg' })
export class HtgPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatHtg(value);
  }
}

// Impur : suit la langue choisie (mois, « aujourd'hui »...).
@Pipe({ name: 'dateTime', pure: false })
export class DateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}

// Impur : suit la langue choisie (mois, « aujourd'hui »...).
@Pipe({ name: 'date', pure: false })
export class DatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDate(value);
  }
}

// Impur : suit la langue choisie (mois, « aujourd'hui »...).
@Pipe({ name: 'ago', pure: false })
export class AgoPipe implements PipeTransform {
  transform(value: string): string {
    return formatAgo(value);
  }
}
