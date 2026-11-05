import { describe, expect, it } from 'vitest';
import {
  calculate,
  calculateBatch,
  calcReturnLoss,
  priceForMargin,
  priceForProfit,
  round2,
  type CalcInput,
} from './calc';

/**
 * Базовый пример (его удобно повторить в Excel):
 * P = 1000, C = 400, k = 15%, L = 50, S = 10, U = 20, a = 5%, выкуп 100%, УСН 6%.
 * Комиссия 150, реклама 50, расходы до налога 680, налог 60, прибыль 260.
 */
const base: CalcInput = {
  price: 1000,
  cost: 400,
  commissionPct: 15,
  logistics: 50,
  storage: 10,
  packaging: 20,
  adsPct: 5,
  buyoutPct: 100,
  returnLogistics: 0,
  taxSystem: 'usn6',
  customTaxPct: 0,
};

function expectNoNaN(obj: unknown) {
  const json = JSON.stringify(obj, (_k, v) =>
    typeof v === 'number' && !Number.isFinite(v) ? `BAD:${v}` : v,
  );
  expect(json).not.toContain('BAD:');
}

describe('calculate', () => {
  it('считает базовый пример с УСН 6% и выкупом 100%', () => {
    const r = calculate(base);
    expect(r.commission).toBe(150);
    expect(r.ads).toBe(50);
    expect(r.returnLoss).toBe(0);
    expect(r.expensesBeforeTax).toBe(680);
    expect(r.tax).toBe(60);
    expect(r.profit).toBe(260);
    expect(r.marginPct).toBe(26);
    expect(r.roiPct).toBe(65);
    expect(r.status).toBe('profit');
    expect(r.warnings).toEqual([]);
  });

  it('учитывает потери на невыкупах при выкупе 50%', () => {
    const r = calculate({ ...base, buyoutPct: 50, returnLogistics: 100 });
    // R × (1 − b) / b = 100 × 0.5 / 0.5 = 100
    expect(r.returnLoss).toBe(100);
    expect(r.expensesBeforeTax).toBe(780);
    expect(r.profit).toBe(160);
    expect(r.marginPct).toBe(16);
  });

  it('пример 2 из README: выкуп 50% и УСН 15%', () => {
    const r = calculate({ ...base, buyoutPct: 50, returnLogistics: 100, taxSystem: 'usn15' });
    expect(r.expensesBeforeTax).toBe(780);
    expect(r.tax).toBe(33);
    expect(r.profit).toBe(187);
    expect(round2(r.marginPct!)).toBe(18.7);
    expect(round2(r.roiPct!)).toBe(46.75);
  });

  it('при выкупе 100% обратная логистика не влияет на прибыль', () => {
    const r = calculate({ ...base, returnLogistics: 500 });
    expect(r.returnLoss).toBe(0);
    expect(r.profit).toBe(260);
  });

  it('УСН «Доходы минус расходы» берёт налог с разницы', () => {
    const r = calculate({ ...base, taxSystem: 'usn15' });
    // (1000 − 680) × 15% = 48
    expect(r.tax).toBe(48);
    expect(r.profit).toBe(272);
  });

  it('УСН 15%: налог не бывает отрицательным при убытке', () => {
    const r = calculate({ ...base, price: 500, taxSystem: 'usn15' });
    expect(r.tax).toBe(0);
    expect(r.profit).toBeLessThan(0);
  });

  it('НПД 4% и своя ставка', () => {
    expect(calculate({ ...base, taxSystem: 'npd' }).tax).toBe(40);
    const custom = calculate({ ...base, taxSystem: 'custom', customTaxPct: 7 });
    expect(custom.tax).toBe(70);
    expect(custom.taxRate).toBe(7);
  });

  it('убыточный товар получает статус loss', () => {
    const r = calculate({ ...base, price: 500 });
    // комиссия 75, реклама 25, расходы 580, налог 30
    expect(r.expensesBeforeTax).toBe(580);
    expect(r.profit).toBe(-110);
    expect(r.marginPct).toBe(-22);
    expect(r.status).toBe('loss');
  });

  it('маржинальность ниже 10% получает статус low', () => {
    const r = calculate({ ...base, cost: 600 });
    expect(r.profit).toBe(60);
    expect(r.marginPct).toBe(6);
    expect(r.status).toBe('low');
  });

  it('нулевая цена не даёт NaN и Infinity', () => {
    const r = calculate({ ...base, price: 0 });
    expect(r.marginPct).toBeNull();
    expect(r.profit).toBe(-480);
    expect(r.roiPct).toBe(-120);
    expect(r.status).toBe('loss');
    expect(r.warnings).toContain('zero_price');
    expectNoNaN(r);
  });

  it('нулевая себестоимость: ROI не считается', () => {
    const r = calculate({ ...base, cost: 0 });
    expect(r.roiPct).toBeNull();
    expect(r.warnings).toContain('zero_cost');
    expectNoNaN(r);
  });

  it('выкуп 0% даёт предупреждение без деления на ноль', () => {
    const r = calculate({ ...base, buyoutPct: 0, returnLogistics: 100 });
    expect(r.warnings).toContain('zero_buyout');
    expect(r.returnLoss).toBe(0);
    expectNoNaN(r);
  });

  it('мусорный ввод (NaN, Infinity) не ломает расчёт', () => {
    const r = calculate({ ...base, price: NaN, cost: Infinity, adsPct: -Infinity });
    expectNoNaN(r);
  });

  it('разбивка расходов в сумме равна расходам до налога плюс налог', () => {
    const r = calculate({ ...base, buyoutPct: 80, returnLogistics: 60 });
    const total = r.breakdown.reduce((s, i) => s + i.value, 0);
    expect(round2(total)).toBe(round2(r.expensesBeforeTax + r.tax));
  });
});

describe('calcReturnLoss', () => {
  it('выкуп 80% и обратная логистика 60 ₽ → 15 ₽ на выкупленную единицу', () => {
    expect(round2(calcReturnLoss(60, 80))).toBe(15);
  });
});

describe('priceForMargin', () => {
  it('формула из ТЗ для УСН 6%', () => {
    const r = priceForMargin(base, 20);
    // (400 + 50 + 10 + 20) / (1 − 0.15 − 0.05 − 0.06 − 0.2) = 480 / 0.54
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(round2(r.price)).toBe(888.89);
    expect(round2(calculate({ ...base, price: r.price }).marginPct!)).toBe(20);
  });

  it('для УСН 15% рекомендованная цена даёт ровно целевую маржу', () => {
    const input: CalcInput = { ...base, taxSystem: 'usn15', buyoutPct: 70, returnLogistics: 50 };
    const r = priceForMargin(input, 25);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(round2(calculate({ ...input, price: r.price }).marginPct!)).toBe(25);
  });

  it('недостижимая маржа при слишком больших процентах', () => {
    const r = priceForMargin({ ...base, commissionPct: 50, adsPct: 20 }, 30);
    expect(r).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('выкуп 0% — расчёт невозможен', () => {
    expect(priceForMargin({ ...base, buyoutPct: 0 }, 10)).toEqual({ ok: false, reason: 'zero_buyout' });
  });
});

describe('priceForProfit', () => {
  it('цена под прибыль 200 ₽ при УСН 6%', () => {
    const r = priceForProfit(base, 200);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(round2(r.price)).toBe(918.92);
    expect(round2(calculate({ ...base, price: r.price }).profit)).toBe(200);
  });

  it('цена под прибыль при УСН 15%', () => {
    const input: CalcInput = { ...base, taxSystem: 'usn15' };
    const r = priceForProfit(input, 300);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(round2(calculate({ ...input, price: r.price }).profit)).toBe(300);
  });
});

describe('calculateBatch', () => {
  it('прибыль с партии и точка безубыточности', () => {
    const r = calculateBatch(base, 100);
    expect(r.investment).toBe(40000);
    expect(r.batchProfit).toBe(26000);
    // каждая продажа возвращает 260 + 400 = 660 ₽ → 40000 / 660 = 60.6 → 61 шт.
    expect(r.breakEvenUnits).toBe(61);
    expect(r.paysBackWithinBatch).toBe(true);
  });

  it('если продажа не покрывает даже закупку, партия не окупается', () => {
    const r = calculateBatch({ ...base, price: 0 }, 10);
    expect(r.breakEvenUnits).toBeNull();
    expect(r.paysBackWithinBatch).toBe(false);
    expectNoNaN(r);
  });
});
