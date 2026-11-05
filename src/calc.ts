/**
 * Формулы юнит-экономики для селлеров WB и Ozon.
 *
 * Все тарифы (комиссия, логистика, налог) вводит пользователь — в коде нет
 * зашитых значений маркетплейсов, только значения полей по умолчанию.
 *
 * Обозначения из ТЗ: P цена, C себестоимость, k комиссия %, L логистика,
 * S хранение, U упаковка, a реклама %, b процент выкупа (0..1),
 * R обратная логистика, t налог %.
 */

export type Marketplace = 'wb' | 'ozon';

/** usn6 — УСН «Доходы», usn15 — УСН «Доходы минус расходы», npd — НПД, custom — своя ставка. */
export type TaxSystem = 'usn6' | 'usn15' | 'npd' | 'custom';

export const TAX_SYSTEMS: { id: TaxSystem; label: string; rate: number | null }[] = [
  { id: 'usn6', label: 'УСН «Доходы» 6%', rate: 6 },
  { id: 'usn15', label: 'УСН «Доходы минус расходы» 15%', rate: 15 },
  { id: 'npd', label: 'НПД 4%', rate: 4 },
  { id: 'custom', label: 'Своя ставка', rate: null },
];

export interface CalcInput {
  /** P — цена продажи, ₽ */
  price: number;
  /** C — себестоимость, ₽ */
  cost: number;
  /** k — комиссия маркетплейса, % */
  commissionPct: number;
  /** L — логистика до клиента, ₽ */
  logistics: number;
  /** S — хранение на единицу, ₽ */
  storage: number;
  /** U — упаковка и маркировка, ₽ */
  packaging: number;
  /** a — реклама, % от цены */
  adsPct: number;
  /** процент выкупа, % (0..100) */
  buyoutPct: number;
  /** R — обратная логистика, ₽ */
  returnLogistics: number;
  taxSystem: TaxSystem;
  /** ставка для taxSystem = 'custom', % */
  customTaxPct: number;
}

export type ResultStatus = 'profit' | 'low' | 'loss';

export type CalcWarning = 'zero_buyout' | 'zero_price' | 'zero_cost';

export interface CalcResult {
  commission: number;
  ads: number;
  /** Потери на невыкупах на одну выкупленную единицу */
  returnLoss: number;
  /** Расходы до налога */
  expensesBeforeTax: number;
  tax: number;
  taxRate: number;
  profit: number;
  /** Маржинальность, %; null при нулевой цене */
  marginPct: number | null;
  /** ROI, %; null при нулевой себестоимости */
  roiPct: number | null;
  status: ResultStatus;
  warnings: CalcWarning[];
  breakdown: BreakdownItem[];
}

export type BreakdownKey = 'cost' | 'commission' | 'logistics' | 'tax' | 'ads' | 'other';

export interface BreakdownItem {
  key: BreakdownKey;
  label: string;
  value: number;
}

/** Порог «низкой» маржинальности для жёлтого цвета итога, %. */
export const LOW_MARGIN_PCT = 10;

/** Превращает любое нечисловое/бесконечное значение в 0, чтобы NaN не расползался по расчёту. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Округление до копеек для отображения и сравнения в тестах. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getTaxRate(taxSystem: TaxSystem, customTaxPct: number): number {
  const preset = TAX_SYSTEMS.find((t) => t.id === taxSystem);
  return preset && preset.rate !== null ? preset.rate : finite(customTaxPct);
}

/**
 * Потери на невыкупах на одну выкупленную единицу: R × (1 − b) / b.
 * При b ≤ 0 формула не определена — возвращаем 0, а вызывающий код
 * показывает предупреждение.
 */
export function calcReturnLoss(returnLogistics: number, buyoutPct: number): number {
  const b = finite(buyoutPct) / 100;
  if (b <= 0) return 0;
  return (finite(returnLogistics) * (1 - b)) / b;
}

export function calculate(input: CalcInput): CalcResult {
  const P = finite(input.price);
  const C = finite(input.cost);
  const k = finite(input.commissionPct);
  const L = finite(input.logistics);
  const S = finite(input.storage);
  const U = finite(input.packaging);
  const a = finite(input.adsPct);
  const R = finite(input.returnLogistics);
  const t = getTaxRate(input.taxSystem, input.customTaxPct);

  const warnings: CalcWarning[] = [];
  if (finite(input.buyoutPct) <= 0) warnings.push('zero_buyout');
  if (P <= 0) warnings.push('zero_price');
  if (C <= 0) warnings.push('zero_cost');

  const commission = (P * k) / 100;
  const ads = (P * a) / 100;
  const returnLoss = calcReturnLoss(R, input.buyoutPct);

  const expensesBeforeTax = C + commission + L + S + U + ads + returnLoss;

  const tax =
    input.taxSystem === 'usn15'
      ? Math.max(0, ((P - expensesBeforeTax) * t) / 100)
      : (P * t) / 100;

  const profit = P - expensesBeforeTax - tax;
  const marginPct = P > 0 ? (profit / P) * 100 : null;
  const roiPct = C > 0 ? (profit / C) * 100 : null;

  let status: ResultStatus;
  if (profit < 0) status = 'loss';
  else if (marginPct === null || marginPct < LOW_MARGIN_PCT) status = 'low';
  else status = 'profit';

  const breakdown: BreakdownItem[] = [
    { key: 'cost', label: 'Себестоимость', value: C },
    { key: 'commission', label: 'Комиссия', value: commission },
    { key: 'logistics', label: 'Логистика и невыкупы', value: L + returnLoss },
    { key: 'tax', label: 'Налог', value: tax },
    { key: 'ads', label: 'Реклама', value: ads },
    { key: 'other', label: 'Хранение и упаковка', value: S + U },
  ];

  return {
    commission,
    ads,
    returnLoss,
    expensesBeforeTax,
    tax,
    taxRate: t,
    profit,
    marginPct,
    roiPct,
    status,
    warnings,
    breakdown,
  };
}

/* ------------------------------------------------------------------ */
/* Обратный расчёт                                                     */
/* ------------------------------------------------------------------ */

export type PriceResult =
  | { ok: true; price: number }
  | { ok: false; reason: 'unreachable' | 'zero_buyout' };

/** Расходы, не зависящие от цены: C + L + S + U + потери на невыкупах. */
function fixedCosts(input: CalcInput): number {
  return (
    finite(input.cost) +
    finite(input.logistics) +
    finite(input.storage) +
    finite(input.packaging) +
    calcReturnLoss(input.returnLogistics, input.buyoutPct)
  );
}

/**
 * Рекомендованная цена для целевой маржинальности m, %.
 *
 * Для налога «от цены» (УСН 6%, НПД, своя ставка) — формула из ТЗ:
 *   P = (C + L + S + U + потери) / (1 − k/100 − a/100 − t/100 − m/100)
 *
 * Для УСН 15% налог берётся с разницы (P − расходы), поэтому формула из ТЗ
 * дала бы цену, при которой фактическая маржа не совпадает с целевой.
 * Используем точное решение уравнения прибыль = m × P:
 *   P = F × (1 − t) / ((1 − k − a) × (1 − t) − m)   (доли, не проценты)
 */
export function priceForMargin(input: CalcInput, marginPct: number): PriceResult {
  if (finite(input.buyoutPct) <= 0) return { ok: false, reason: 'zero_buyout' };

  const F = fixedCosts(input);
  const k = finite(input.commissionPct) / 100;
  const a = finite(input.adsPct) / 100;
  const t = getTaxRate(input.taxSystem, input.customTaxPct) / 100;
  const m = finite(marginPct) / 100;

  let numerator: number;
  let denominator: number;
  if (input.taxSystem === 'usn15') {
    numerator = F * (1 - t);
    denominator = (1 - k - a) * (1 - t) - m;
  } else {
    numerator = F;
    denominator = 1 - k - a - t - m;
  }

  if (denominator <= 0) return { ok: false, reason: 'unreachable' };
  const price = numerator / denominator;
  if (!Number.isFinite(price)) return { ok: false, reason: 'unreachable' };
  return { ok: true, price };
}

/**
 * Рекомендованная цена для целевой прибыли X, ₽ с единицы.
 *
 * Налог от цены:  P = (F + X) / (1 − k − a − t)
 * УСН 15%:        P = (F + X / (1 − t)) / (1 − k − a)
 */
export function priceForProfit(input: CalcInput, profit: number): PriceResult {
  if (finite(input.buyoutPct) <= 0) return { ok: false, reason: 'zero_buyout' };

  const F = fixedCosts(input);
  const X = finite(profit);
  const k = finite(input.commissionPct) / 100;
  const a = finite(input.adsPct) / 100;
  const t = getTaxRate(input.taxSystem, input.customTaxPct) / 100;

  let price: number;
  if (input.taxSystem === 'usn15') {
    if (t >= 1 || 1 - k - a <= 0) return { ok: false, reason: 'unreachable' };
    price = (F + X / (1 - t)) / (1 - k - a);
  } else {
    const denominator = 1 - k - a - t;
    if (denominator <= 0) return { ok: false, reason: 'unreachable' };
    price = (F + X) / denominator;
  }

  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'unreachable' };
  return { ok: true, price };
}

export interface BatchResult {
  quantity: number;
  /** Вложения в партию: себестоимость × количество */
  investment: number;
  /** Прибыль со всей партии, если она выкуплена полностью */
  batchProfit: number;
  /** Сколько штук нужно продать, чтобы вернуть вложения; null — не окупается */
  breakEvenUnits: number | null;
  /** Окупается ли партия в пределах своего объёма */
  paysBackWithinBatch: boolean;
}

/**
 * Прибыль с партии и точка безубыточности.
 *
 * Каждая проданная единица возвращает «прибыль + себестоимость»
 * (выручка за вычетом всех расходов, кроме закупки). Точка безубыточности —
 * сколько таких единиц покрывают вложения в закупку всей партии.
 */
export function calculateBatch(input: CalcInput, quantity: number): BatchResult {
  const q = Math.max(0, Math.floor(finite(quantity)));
  const { profit } = calculate(input);
  const C = finite(input.cost);
  const investment = C * q;
  const batchProfit = profit * q;

  const perUnitReturn = profit + C;
  let breakEvenUnits: number | null;
  if (investment === 0) breakEvenUnits = 0;
  else if (perUnitReturn <= 0) breakEvenUnits = null;
  else breakEvenUnits = Math.ceil(investment / perUnitReturn - 1e-9);

  return {
    quantity: q,
    investment,
    batchProfit,
    breakEvenUnits,
    paysBackWithinBatch: breakEvenUnits !== null && breakEvenUnits <= q,
  };
}
