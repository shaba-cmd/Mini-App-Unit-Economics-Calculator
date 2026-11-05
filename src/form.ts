import type { CalcInput, Marketplace, TaxSystem } from './calc';

/** Состояние формы: числа хранятся строками, как их ввёл пользователь. */
export interface CalcForm {
  marketplace: Marketplace;
  productName: string;
  price: string;
  cost: string;
  commissionPct: string;
  logistics: string;
  storage: string;
  packaging: string;
  adsPct: string;
  buyoutPct: string;
  returnLogistics: string;
  taxSystem: TaxSystem;
  customTaxPct: string;
}

export type NumericField = Exclude<keyof CalcForm, 'marketplace' | 'productName' | 'taxSystem'>;

export const DEFAULT_FORM: CalcForm = {
  marketplace: 'wb',
  productName: '',
  price: '',
  cost: '',
  commissionPct: '15',
  logistics: '0',
  storage: '0',
  packaging: '0',
  adsPct: '0',
  buyoutPct: '100',
  returnLogistics: '0',
  taxSystem: 'usn6',
  customTaxPct: '',
};

export const PRODUCT_NAME_MAX = 60;

/**
 * Разбирает число из строки: допускает запятую и точку как разделитель,
 * пробелы между разрядами. Пустая строка и мусор → null.
 */
export function parseNumber(raw: string): number | null {
  const normalized = raw.replace(/[\s ]/g, '').replace(',', '.');
  if (normalized === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

interface FieldRule {
  label: string;
  required?: boolean;
  /** Сообщение для пустого обязательного поля */
  emptyMessage?: string;
  min?: number;
  /** Строгое «больше min» */
  minExclusive?: boolean;
  max?: number;
}

const RULES: Record<NumericField, FieldRule> = {
  price: { label: 'Цена продажи', required: true, emptyMessage: 'Введите цену продажи', min: 0, minExclusive: true },
  cost: { label: 'Себестоимость', required: true, emptyMessage: 'Введите себестоимость', min: 0 },
  commissionPct: { label: 'Комиссия', required: true, emptyMessage: 'Введите комиссию маркетплейса', min: 0, max: 100 },
  logistics: { label: 'Логистика', min: 0 },
  storage: { label: 'Хранение', min: 0 },
  packaging: { label: 'Упаковка', min: 0 },
  adsPct: { label: 'Реклама', min: 0, max: 100 },
  buyoutPct: { label: 'Процент выкупа', required: true, emptyMessage: 'Введите процент выкупа', min: 0, minExclusive: true, max: 100 },
  returnLogistics: { label: 'Обратная логистика', min: 0 },
  customTaxPct: { label: 'Ставка налога', required: true, emptyMessage: 'Введите ставку налога', min: 0, max: 100 },
};

export type FormErrors = Partial<Record<NumericField, string>>;

export function validateField(field: NumericField, raw: string): string | undefined {
  const rule = RULES[field];
  const trimmed = raw.trim();
  if (trimmed === '') {
    return rule.required ? rule.emptyMessage : undefined;
  }
  const value = parseNumber(trimmed);
  if (value === null) return `${rule.label}: введите число, например 1250 или 12,5`;
  if (value < 0) return `${rule.label}: значение не может быть отрицательным`;
  if (rule.min !== undefined && rule.minExclusive && value <= rule.min) {
    return `${rule.label}: значение должно быть больше нуля`;
  }
  if (rule.max !== undefined && value > rule.max) return `${rule.label}: не больше ${rule.max}%`;
  return undefined;
}

export function validateForm(form: CalcForm): FormErrors {
  const errors: FormErrors = {};
  for (const field of Object.keys(RULES) as NumericField[]) {
    if (field === 'customTaxPct' && form.taxSystem !== 'custom') continue;
    const error = validateField(field, form[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Преобразует форму во входные данные расчёта; пустые необязательные поля → 0. */
export function toCalcInput(form: CalcForm): CalcInput {
  const num = (field: NumericField) => parseNumber(form[field]) ?? 0;
  return {
    price: num('price'),
    cost: num('cost'),
    commissionPct: num('commissionPct'),
    logistics: num('logistics'),
    storage: num('storage'),
    packaging: num('packaging'),
    adsPct: num('adsPct'),
    buyoutPct: num('buyoutPct'),
    returnLogistics: num('returnLogistics'),
    taxSystem: form.taxSystem,
    customTaxPct: num('customTaxPct'),
  };
}

/** Восстанавливает форму из сохранённых данных, подставляя значения по умолчанию для отсутствующих полей. */
export function normalizeForm(data: unknown): CalcForm {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const form: CalcForm = { ...DEFAULT_FORM };
  for (const key of Object.keys(DEFAULT_FORM) as (keyof CalcForm)[]) {
    const value = source[key];
    if (typeof value === 'string') (form as unknown as Record<string, string>)[key] = value;
  }
  if (form.marketplace !== 'wb' && form.marketplace !== 'ozon') form.marketplace = 'wb';
  if (!['usn6', 'usn15', 'npd', 'custom'].includes(form.taxSystem)) form.taxSystem = 'usn6';
  form.productName = form.productName.slice(0, PRODUCT_NAME_MAX);
  return form;
}
