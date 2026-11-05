const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const intFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Деньги: «1 250,5 ₽». Для null, NaN и Infinity — прочерк. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // -0 → 0, чтобы не показывать «−0 ₽»
  const v = Math.abs(value) < 0.005 ? 0 : value;
  return `${moneyFormatter.format(v)} ₽`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const v = Math.abs(value) < 0.05 ? 0 : value;
  return `${percentFormatter.format(v)}%`;
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return intFormatter.format(value);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Число для подстановки в поле ввода: без пробелов, с запятой, до 2 знаков. */
export function toInputValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100).replace('.', ',');
}
